// app/ligas-fantasy/join/[leagueId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';

export default function JoinLeague({ params }: { params: { leagueId: string } }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();
  const { leagueId } = params;
  const [status, setStatus] = useState<'loading' | 'joining' | 'success' | 'error' | 'member'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const handleJoin = async () => {
      // If not signed in, redirect to sign-in with return URL
      if (!isSignedIn || !user?.id) {
        router.push(`/sign-in?redirect_url=${encodeURIComponent(`/ligas-fantasy/join/${leagueId}`)}`);
        return;
      }

      try {
        setStatus('joining');
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('Authentication token not available. Please try signing in again.');

        const supabase = createAuthClient(token);

        // Fetch league details and check membership
        const { data: leagueData, error: leagueError } = await supabase
          .from('leagues')
          .select('*, league_members (user_id)')
          .eq('id', leagueId)
          .single();
        if (leagueError) throw new Error(leagueError.message);
        if (!leagueData) throw new Error('League not found.');

        const members = leagueData.league_members as { user_id: string }[];
        if (members.some((m) => m.user_id === user.id)) {
          setStatus('member');
          setMessage('You are already a member of this league.');
          setTimeout(() => router.push('/ligas-fantasy'), 2000); // Redirect after showing message
          return;
        }

        // Join the league
        const { error: joinError } = await supabase
          .from('league_members')
          .insert({
            league_id: leagueId,
            user_id: user.id,
            role: 'member',
          });
        if (joinError) throw new Error(joinError.message);

        setStatus('success');
        setMessage('Successfully joined the league!');
        setTimeout(() => router.push('/ligas-fantasy'), 2000); // Redirect after showing success
      } catch (err: any) {
        setStatus('error');
        setMessage(`Error: ${err.message}`);
        console.error('Error joining league:', err);
      }
    };

    handleJoin();
  }, [isLoaded, isSignedIn, user?.id, getToken, leagueId, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 p-6 rounded-lg border border-amber-500/30 shadow-xl w-full max-w-md text-center">
        {status === 'loading' && <p className="text-white font-exo2">Loading...</p>}
        {status === 'joining' && <p className="text-white font-exo2">Joining league...</p>}
        {status === 'success' && (
          <>
            <p className="text-green-400 font-exo2 mb-4">{message}</p>
            <p className="text-gray-300 font-exo2">Redirecting to leagues...</p>
          </>
        )}
        {status === 'member' && (
          <>
            <p className="text-amber-400 font-exo2 mb-4">{message}</p>
            <p className="text-gray-300 font-exo2">Redirecting to leagues...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-red-400 font-exo2 mb-4">{message}</p>
            <button
              onClick={() => router.push('/ligas-fantasy')}
              className="px-4 py-2 bg-gray-700 text-white rounded font-exo2 hover:bg-gray-600 hover:text-amber-400 transition"
              aria-label="Back to leagues"
            >
              Back to Leagues
            </button>
          </>
        )}
      </div>
    </div>
  );
}