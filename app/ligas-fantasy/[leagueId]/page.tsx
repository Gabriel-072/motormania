'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { League } from '@/app/types/league';
import { useDropzone } from 'react-dropzone';

type LeaderboardEntry = {
  user_id: string;
  username: string;
  profile_image_url: string;
  total_score: number;
};

export default function LeagueDetails({ params }: { params: { leagueId: string } }) {
  const { isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const { leagueId } = params;

  const [league, setLeague] = useState<League | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState({ members: 0, predictors: 0 });
  const [isOwner, setIsOwner] = useState(false);
  const [newProfileImage, setNewProfileImage] = useState<File | null>(null);
  const [updatingImage, setUpdatingImage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) setNewProfileImage(acceptedFiles[0]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1,
    disabled: !isOwner || updatingImage,
  });

  const sanitizeFileName = (fileName: string): string => {
    return fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  };

  useEffect(() => {
    if (!isLoaded || !user?.id) return;

    const fetchLeagueData = async () => {
      setLoading(true);
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('Authentication token not available');
        const supabase = createAuthClient(token);

        const { data: leagueData, error: leagueError } = await supabase
          .from('leagues')
          .select('id, owner_id, name, description, profile_image_url, join_password, is_private, created_at, updated_at')
          .eq('id', leagueId)
          .single();
        if (leagueError) throw leagueError;
        if (!leagueData) throw new Error('League not found');
        setLeague(leagueData);
        setIsOwner(leagueData.owner_id === user.id);

        const { data: membership, error: memberError } = await supabase
          .from('league_members')
          .select('user_id')
          .eq('league_id', leagueId)
          .eq('user_id', user.id);
        if (memberError) throw memberError;

        if (!membership.length) {
          const password = prompt('Enter the join password to join this league:');
          if (password && password === leagueData.join_password) {
            const { error: joinError } = await supabase
              .from('league_members')
              .insert({ league_id: leagueId, user_id: user.id, role: 'member' });
            if (joinError) throw joinError;
          } else {
            throw new Error('Invalid password. Please join manually via the Leagues page.');
          }
        }

        const { count: memberCount, error: countError } = await supabase
          .from('league_members')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', leagueId);
        if (countError) throw countError;

        const { data: membersData, error: membersError } = await supabase
          .from('league_members')
          .select('user_id')
          .eq('league_id', leagueId);
        if (membersError) throw membersError;
        const userIds = membersData.map((m) => m.user_id);

        const { count: predictorCount } = await supabase
          .from('prediction_scores')
          .select('user_id', { count: 'exact', head: true })
          .in('user_id', userIds);
        setStats({ members: memberCount || 0, predictors: predictorCount || 0 });

        const { data: scoresData, error: scoresError } = await supabase
          .from('prediction_scores')
          .select('user_id, score')
          .in('user_id', userIds);
        if (scoresError) throw scoresError;

        const usersResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds }),
        });
        if (!usersResponse.ok) throw new Error('Failed to fetch user data');
        const users = await usersResponse.json();

        const leaderboardData = userIds
          .map((userId) => {
            const userScores = scoresData.filter((s) => s.user_id === userId);
            const totalScore = userScores.reduce((sum, s) => sum + s.score, 0);
            const userData = users.find((u: any) => u.id === userId);
            return {
              user_id: userId,
              username: userData?.fullName || 'Unknown',
              profile_image_url: userData?.profileImageUrl || '/default-profile.png',
              total_score: totalScore,
            };
          })
          .sort((a, b) => b.total_score - a.total_score)
          .slice(0, 10);
        setLeaderboard(leaderboardData);

        const channel = supabase
          .channel(`league_${leagueId}_scores`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'prediction_scores', filter: `user_id=in.(${userIds.join(',')})` },
            (payload) => {
              setLeaderboard((prev) => {
                const entry = prev.find((e) => e.user_id === payload.new.user_id);
                if (entry) {
                  entry.total_score += payload.new.score;
                  return [...prev].sort((a, b) => b.total_score - a.total_score).slice(0, 10);
                }
                return prev;
              });
            }
          )
          .subscribe();
        return () => supabase.removeChannel(channel);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [isLoaded, user?.id, leagueId, getToken, router]);

  const handleUpdateProfileImage = async () => {
    if (!newProfileImage || !isOwner || !user?.id) return;
    setUpdatingImage(true);
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('Authentication token not available');
      const supabase = createAuthClient(token);

      const sanitizedFileName = sanitizeFileName(newProfileImage.name);
      const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
      const { error: uploadError } = await supabase.storage
        .from('league-images')
        .upload(fileName, newProfileImage);
      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('league-images').getPublicUrl(fileName);
      const newImageUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('leagues')
        .update({ profile_image_url: newImageUrl })
        .eq('id', leagueId);
      if (updateError) throw updateError;

      setLeague((prev) => (prev ? { ...prev, profile_image_url: newImageUrl } : null));
      setNewProfileImage(null);
    } catch (err: any) {
      setError(`Error updating profile image: ${err.message}`);
    } finally {
      setUpdatingImage(false);
    }
  };

  if (!isLoaded || loading) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white font-exo2">Loading...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400 font-exo2">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 p-8">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl md:text-4xl font-bold text-white mb-6 font-exo2 text-center"
      >
        {league?.name}
      </motion.h1>

      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg border border-amber-500/40 p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              {league?.profile_image_url ? (
                <Image
                  src={league.profile_image_url}
                  alt={league.name}
                  width={120}
                  height={120}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold text-4xl">
                  {league?.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-semibold text-white font-exo2">{league?.name}</h2>
              <p className="text-gray-300 font-exo2 mt-2">{league?.description || 'No description'}</p>
              <p className="text-sm text-gray-400 font-exo2 mt-1">Total Jugadores: {stats.members}</p>
              {isOwner && (
                <p className="text-sm text-gray-400 font-exo2 mt-1">
                  Active Predictors: {stats.predictors}/{stats.members}
                </p>
              )}
            </div>
          </div>

          {isOwner && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-amber-400 mb-2 font-exo2">Update Profile Image</h3>
              <div
                {...getRootProps()}
                className={`p-4 border-2 border-dashed rounded-lg text-center ${
                  isDragActive ? 'border-cyan-400 bg-cyan-900/20' : 'border-gray-500 bg-gray-700'
                } ${updatingImage || !isOwner ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input {...getInputProps()} />
                {newProfileImage ? (
                  <div className="flex items-center justify-center gap-2">
                    <Image
                      src={URL.createObjectURL(newProfileImage)}
                      alt="New profile preview"
                      width={80}
                      height={80}
                      className="rounded-full object-cover"
                    />
                    <button
                      onClick={() => setNewProfileImage(null)}
                      className="text-red-400 hover:text-red-300"
                      disabled={updatingImage}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-300 font-exo2">
                    Drag & drop a new image here, or click to select one
                  </p>
                )}
              </div>
              {newProfileImage && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleUpdateProfileImage}
                  disabled={updatingImage}
                  className="mt-4 w-full py-2 bg-cyan-600 text-white rounded font-exo2 hover:bg-cyan-700 transition disabled:opacity-50"
                >
                  {updatingImage ? 'Updating...' : 'Update Image'}
                </motion.button>
              )}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg border border-cyan-500/40 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4 font-exo2">Top 10 Standings</h3>
          {leaderboard.length > 0 ? (
            <div className="space-y-4">
              {leaderboard.map((entry, index) => (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg flex items-center justify-between ${
                    index === 0 ? 'bg-amber-600/20' : index === 1 ? 'bg-amber-500/20' : index === 2 ? 'bg-amber-400/20' : 'bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400 font-bold w-6">{index + 1}</span>
                    <Image
                      src={entry.profile_image_url}
                      alt={entry.username}
                      width={40}
                      height={40}
                      className="rounded-full object-cover"
                    />
                    <span className="text-white font-exo2 truncate max-w-xs">{entry.username}</span>
                  </div>
                  <span className="text-cyan-400 font-bold">{entry.total_score} pts</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 font-exo2">No scores yet for this league.</p>
          )}
        </div>

        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white font-exo2">Coming Soon: Team Selection</h3>
          <p className="text-gray-300 font-exo2">Pick your dream team of 3 drivers and 3 teams per GP—stay tuned!</p>
        </div>

        <button
          onClick={() => router.push('/ligas-fantasy')}
          className="mt-6 px-4 py-2 bg-gray-700 text-white rounded-lg font-exo2 hover:bg-gray-600 transition"
        >
          Back to Leagues
        </button>
      </div>
    </div>
  );
}