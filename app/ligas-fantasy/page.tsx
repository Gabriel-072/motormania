'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useDropzone } from 'react-dropzone';
import InviteFriendsModal from '@/components/InviteFriendsModal';
import { League } from '../types/league';
import { useRouter } from 'next/navigation';

export default function LigasFantasy() {
  const { isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [recentLeagues, setRecentLeagues] = useState<League[]>([]);
  const [myLeaguesLoading, setMyLeaguesLoading] = useState<boolean>(false);
  const [recentLeaguesLoading, setRecentLeaguesLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);

  const [leagueName, setLeagueName] = useState('');
  const [description, setDescription] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [joinInput, setJoinInput] = useState('');
  const [showInviteModal, setShowInviteModal] = useState<{ leagueId: string; joinPassword: string } | null>(null);
  const [showManageModal, setShowManageModal] = useState<League | null>(null);

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

  const sanitizeFileName = (fileName: string): string => {
    return fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  };

  const onDropCreate = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (acceptedFiles.length > 0) {
      setProfileImage(acceptedFiles[0]);
    }
    if (fileRejections.length > 0) {
      const errorMessage = fileRejections[0].errors[0].code === 'file-too-large'
        ? 'La imagen excede el tamaño máximo de 2MB.'
        : 'Por favor, sube una imagen válida.';
      setError(errorMessage);
    }
  }, []);

  const { getRootProps: getRootPropsCreate, getInputProps: getInputPropsCreate, isDragActive: isDragActiveCreate } = useDropzone({
    onDrop: onDropCreate,
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  useEffect(() => {
    if (!isLoaded || !user?.id) return;

    const fetchMyLeagues = async () => {
      setMyLeaguesLoading(true);
      setError(null);
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('No se pudo obtener el token de autenticación');
        const supabase = createAuthClient(token);

        const { data: membershipData, error: membershipError } = await supabase
          .from('league_members')
          .select('league_id')
          .eq('user_id', user.id);
        if (membershipError) throw membershipError;

        const leagueIds = membershipData.map((m: { league_id: string }) => m.league_id);

        if (leagueIds.length > 0) {
          const { data: leaguesData, error: leaguesError } = await supabase
            .from('leagues')
            .select('id, owner_id, name, description, profile_image_url, join_password, is_private, created_at, updated_at')
            .in('id', leagueIds);
          if (leaguesError) throw leaguesError;

          const leaguesWithCounts = await Promise.all(
            leaguesData.map(async (league: League) => {
              const { count, error } = await supabase
                .from('league_members')
                .select('*', { count: 'exact', head: true })
                .eq('league_id', league.id);
              if (error) throw error;
              return { ...league, league_members_count: count ?? 0 };
            })
          );
          setMyLeagues(leaguesWithCounts);
        } else {
          setMyLeagues([]);
        }
      } catch (err: any) {
        setError(`Error al cargar tus ligas: ${err.message}`);
        console.error(err);
      } finally {
        setMyLeaguesLoading(false);
      }
    };

    fetchMyLeagues();
  }, [isLoaded, user?.id, getToken]);

  useEffect(() => {
    if (!isLoaded) return;

    const fetchRecentLeagues = async () => {
      setRecentLeaguesLoading(true);
      setRecentError(null);
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('No se pudo obtener el token de autenticación');
        const supabase = createAuthClient(token);

        const { data, error } = await supabase
          .from('leagues')
          .select('id, owner_id, name, description, profile_image_url, join_password, is_private, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(5);
        if (error) throw error;

        const leaguesWithCounts = await Promise.all(
          data.map(async (league: League) => {
            const { count, error } = await supabase
              .from('league_members')
              .select('*', { count: 'exact', head: true })
              .eq('league_id', league.id);
            if (error) throw error;
            return { ...league, league_members_count: count ?? 0 };
          })
        );
        setRecentLeagues(leaguesWithCounts);
      } catch (err: any) {
        setRecentError(`Error al cargar ligas recientes: ${err.message}`);
        console.error(err);
      } finally {
        setRecentLeaguesLoading(false);
      }
    };

    fetchRecentLeagues();
  }, [isLoaded, getToken]);

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setError('Debes iniciar sesión para crear una liga.');
      return;
    }
    if (!leagueName.trim() || !joinPassword.trim()) {
      setError('El nombre de la liga y la contraseña son obligatorios.');
      return;
    }

    try {
      setMyLeaguesLoading(true);
      setError(null);
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación');
      const supabase = createAuthClient(token);

      const { data: existingLeague, error: nameCheckError } = await supabase
        .from('leagues')
        .select('id')
        .eq('name', leagueName.trim())
        .single();
      if (nameCheckError && nameCheckError.code !== 'PGRST116') throw nameCheckError;
      if (existingLeague) {
        setError('Ya existe una liga con este nombre.');
        return;
      }

      let imageUrl: string | null = null;
      if (profileImage) {
        const sanitizedFileName = sanitizeFileName(profileImage.name);
        const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('league-images')
          .upload(fileName, profileImage);
        if (uploadError) throw new Error(`Error al subir la imagen: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from('league-images').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .insert({
          owner_id: user.id,
          name: leagueName.trim(),
          description: description.trim() || null,
          profile_image_url: imageUrl,
          join_password: joinPassword.trim(),
          is_private: true,
          has_team_selection: false,
        })
        .select()
        .single();
      if (leagueError) throw leagueError;

      const { error: memberError } = await supabase
        .from('league_members')
        .insert({
          league_id: leagueData.id,
          user_id: user.id,
          role: 'owner',
        });
      if (memberError) throw memberError;

      setMyLeagues((prev) => [
        ...prev,
        { ...leagueData, league_members_count: 1 },
      ]);
      setLeagueName('');
      setDescription('');
      setProfileImage(null);
      setJoinPassword('');
      setShowInviteModal({ leagueId: leagueData.id, joinPassword: leagueData.join_password });
    } catch (err: any) {
      setError(`Error al crear la liga: ${err.message}`);
      console.error(err);
    } finally {
      setMyLeaguesLoading(false);
    }
  };

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      setError('Debes iniciar sesión para unirte a una liga.');
      return;
    }
    if (!joinInput.trim()) {
      setError('Por favor, ingresa una contraseña válida.');
      return;
    }

    try {
      setMyLeaguesLoading(true);
      setError(null);
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación');
      const supabase = createAuthClient(token);

      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('id, owner_id, name, description, profile_image_url, join_password, is_private, created_at, updated_at')
        .eq('join_password', joinInput.trim())
        .single();
      if (leagueError) throw leagueError;
      if (!leagueData) throw new Error('No se encontró una liga con esa contraseña.');

      const { data: membership, error: membershipError } = await supabase
        .from('league_members')
        .select('user_id')
        .eq('league_id', leagueData.id)
        .eq('user_id', user.id);
      if (membershipError) throw membershipError;
      if (membership.length > 0) {
        setError('Ya eres miembro de esta liga.');
        return;
      }

      const { error: joinError } = await supabase
        .from('league_members')
        .insert({
          league_id: leagueData.id,
          user_id: user.id,
          role: 'member',
        });
      if (joinError) throw joinError;

      const { count, error: countError } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', leagueData.id);
      if (countError) throw countError;

      setMyLeagues((prev) => [
        ...prev,
        { ...leagueData, league_members_count: count ?? 0 },
      ]);
      setJoinInput('');
      router.push(`/ligas-fantasy/join/${leagueData.id}`);
    } catch (err: any) {
      setError(`Error al unirte a la liga: ${err.message}`);
      console.error(err);
    } finally {
      setMyLeaguesLoading(false);
    }
  };

  const ManageLeagueModal = ({ league, onClose }: { league: League; onClose: () => void }) => {
    const [members, setMembers] = useState<{ user_id: string; role: 'member' | 'owner' }[]>([]);
    const [newProfileImage, setNewProfileImage] = useState<File | null>(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
      const fetchMembers = async () => {
        try {
          const token = await getToken({ template: 'supabase' });
          if (!token) throw new Error('No se pudo obtener el token de autenticación');
          const supabase = createAuthClient(token);

          const { data, error } = await supabase
            .from('league_members')
            .select('user_id, role')
            .eq('league_id', league.id);
          if (error) throw error;
          setMembers(data || []);
        } catch (err: any) {
          setError(`Error al cargar miembros: ${err.message}`);
          console.error(err);
        }
      };
      fetchMembers();
    }, [league.id, getToken]);

    const onDropManage = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
      if (acceptedFiles.length > 0) {
        setNewProfileImage(acceptedFiles[0]);
      }
      if (fileRejections.length > 0) {
        const errorMessage = fileRejections[0].errors[0].code === 'file-too-large'
          ? 'La imagen excede el tamaño máximo de 2MB.'
          : 'Por favor, sube una imagen válida.';
        setError(errorMessage);
      }
    }, []);

    const { getRootProps: getRootPropsManage, getInputProps: getInputPropsManage, isDragActive: isDragActiveManage } = useDropzone({
      onDrop: onDropManage,
      accept: { 'image/*': [] },
      maxFiles: 1,
      maxSize: MAX_FILE_SIZE,
    });

    const handleRemoveMember = async (memberId: string) => {
      if (memberId === user?.id) {
        alert('No puedes eliminarte como propietario.');
        return;
      }
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('No se pudo obtener el token de autenticación');
        const supabase = createAuthClient(token);

        const { error } = await supabase
          .from('league_members')
          .delete()
          .eq('league_id', league.id)
          .eq('user_id', memberId);
        if (error) throw error;

        setMembers((prev) => prev.filter((m) => m.user_id !== memberId));
        setMyLeagues((prev) =>
          prev.map((l) =>
            l.id === league.id ? { ...l, league_members_count: (l.league_members_count || 1) - 1 } : l
          )
        );
      } catch (err: any) {
        setError(`Error al eliminar miembro: ${err.message}`);
        console.error(err);
      }
    };

    const handleUpdateProfileImage = async () => {
      if (!newProfileImage || !user?.id) return;
      try {
        setUpdating(true);
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('No se pudo obtener el token de autenticación');
        const supabase = createAuthClient(token);

        const sanitizedFileName = sanitizeFileName(newProfileImage.name);
        const fileName = `${user.id}/${Date.now()}-${sanitizedFileName}`;
        const { error: uploadError } = await supabase.storage
          .from('league-images')
          .upload(fileName, newProfileImage);
        if (uploadError) throw new Error(`Error al subir la imagen: ${uploadError.message}`);

        const { data: urlData } = supabase.storage.from('league-images').getPublicUrl(fileName);
        const newImageUrl = urlData.publicUrl;

        const { error: updateError } = await supabase
          .from('leagues')
          .update({ profile_image_url: newImageUrl })
          .eq('id', league.id);
        if (updateError) throw updateError;

        setMyLeagues((prev) =>
          prev.map((l) => (l.id === league.id ? { ...l, profile_image_url: newImageUrl } : l))
        );
        setNewProfileImage(null);
      } catch (err: any) {
        setError(`Error al actualizar la imagen de perfil: ${err.message}`);
        console.error(err);
      } finally {
        setUpdating(false);
      }
    };

    const isOwner = league.owner_id === user?.id;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-bold text-white mb-4 font-exo2">Administrar {league.name}</h2>
          {isOwner ? (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-amber-400 mb-2 font-exo2">Imagen de Perfil</h3>
                <div className="flex items-center mb-2">
                  {league.profile_image_url ? (
                    <div className="w-12 h-12 rounded-full overflow-hidden mr-2">
                      <Image
                        src={league.profile_image_url}
                        alt={league.name}
                        width={48}
                        height={48}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold mr-2">
                      {league.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div
                    {...getRootPropsManage()}
                    className={`p-4 border-2 border-dashed rounded-lg text-center flex-1 ${
                      isDragActiveManage ? 'border-cyan-400 bg-cyan-900/20' : 'border-gray-500 bg-gray-700'
                    }`}
                  >
                    <input {...getInputPropsManage()} />
                    {newProfileImage ? (
                      <div className="flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full overflow-hidden">
                          <Image
                            src={URL.createObjectURL(newProfileImage)}
                            alt="Vista previa de la nueva imagen"
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <button
                          onClick={() => setNewProfileImage(null)}
                          className="ml-2 text-red-400 hover:text-red-300"
                          aria-label="Eliminar imagen nueva"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <p className="text-gray-300 font-exo2 text-sm">
                        Arrastra y suelta una imagen (máx. 2MB), o haz clic para seleccionar
                      </p>
                    )}
                  </div>
                </div>
                {newProfileImage && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleUpdateProfileImage}
                    disabled={updating}
                    className="w-full py-2 bg-cyan-600 text-white rounded font-exo2 hover:bg-cyan-700 transition disabled:opacity-50"
                  >
                    {updating ? 'Actualizando...' : 'Actualizar Imagen de Perfil'}
                  </motion.button>
                )}
              </div>
              <h3 className="text-lg font-semibold text-amber-400 mb-2 font-exo2">Miembros</h3>
              <div className="max-h-64 overflow-y-auto mb-4">
                {members.map((member) => (
                  <div key={member.user_id} className="flex justify-between items-center p-2 border-b border-gray-700">
                    <span className="text-white font-exo2">
                      {member.user_id} {member.role === 'owner' && '(Propietario)'}
                    </span>
                    {member.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        className="text-red-400 hover:text-red-300 font-exo2"
                        aria-label={`Eliminar a ${member.user_id} de la liga`}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-300 font-exo2">Solo el propietario puede gestionar miembros y actualizar la imagen.</p>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="w-full py-2 bg-gray-700 text-white rounded font-exo2 hover:bg-gray-600 hover:text-amber-400 transition"
            aria-label="Cerrar modal"
          >
            Cerrar
          </motion.button>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white overflow-hidden relative p-8">
      <motion.h1
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 mb-10 tracking-wider font-exo2 text-center"
      >
        Ligas Fantasy
      </motion.h1>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-400 font-exo2"
        >
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-2xl font-semibold text-white mb-4 font-exo2">Mis Ligas</h2>
          <div
            className="animate-rotate-border rounded-xl p-0.5"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '6s',
            }}
          >
            <div className="bg-gradient-to-br from-gray-900 to-black p-4 rounded-xl shadow-lg">
              {myLeaguesLoading ? (
                <p className="text-gray-400 animate-pulse font-exo2">Cargando tus ligas...</p>
              ) : myLeagues.length === 0 ? (
                <p className="text-gray-400 font-exo2">Aún no perteneces a ninguna liga. ¡Crea o únete a una!</p>
              ) : (
                <div className="space-y-4">
                  {myLeagues.map((league, index) => {
                    const isOwner = league.owner_id === user?.id;
                    return (
                      <motion.div
                        key={league.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="p-4 bg-gray-800 rounded-lg border border-amber-500/40 flex items-center space-x-4 hover:shadow-amber-500/30 transition-all cursor-pointer"
                        onClick={() => router.push(`/ligas-fantasy/join/${league.id}`)}
                      >
                        {league.profile_image_url ? (
                          <div className="w-12 h-12 rounded-full overflow-hidden">
                            <Image
                              src={league.profile_image_url}
                              alt={league.name}
                              width={48}
                              height={48}
                              className="object-cover w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold">
                            {league.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold text-white font-exo2">{league.name}</h3>
                          <p className="text-sm text-gray-300 font-exo2">
                            {league.league_members_count || 0} Jugadores
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowInviteModal({ leagueId: league.id, joinPassword: league.join_password });
                            }}
                            className="px-3 py-1 bg-blue-600 rounded text-white text-sm hover:bg-blue-700 transition font-exo2"
                            aria-label={`Invitar amigos a ${league.name}`}
                          >
                            Invitar
                          </motion.button>
                          {isOwner && (
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowManageModal(league);
                              }}
                              className="px-3 py-1 bg-purple-600 rounded text-white text-sm hover:bg-purple-700 transition font-exo2"
                              aria-label={`Administrar ${league.name}`}
                            >
                              Administrar
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-2xl font-semibold text-white mb-4 font-exo2">Últimas Ligas</h2>
          <div
            className="animate-rotate-border rounded-xl p-0.5"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #1e3a8a 20deg, #38bdf8 30deg, #1e3a8a 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '5s',
            }}
          >
            <div className="bg-gradient-to-br from-gray-900 to-black p-4 rounded-xl shadow-lg">
              {recentLeaguesLoading ? (
                <p className="text-gray-400 animate-pulse font-exo2">Cargando ligas recientes...</p>
              ) : recentError ? (
                <p className="text-red-400 font-exo2">{recentError}</p>
              ) : recentLeagues.length === 0 ? (
                <p className="text-gray-400 font-exo2">No hay ligas recientes creadas aún.</p>
              ) : (
                <div className="space-y-4">
                  {recentLeagues.map((league, index) => (
                    <motion.div
                      key={league.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="p-4 bg-gray-800 rounded-lg border border-cyan-500/40 flex items-center space-x-4 hover:shadow-cyan-500/30 transition-all"
                    >
                      {league.profile_image_url ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden">
                          <Image
                            src={league.profile_image_url}
                            alt={league.name}
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center text-white font-bold">
                          {league.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-white font-exo2">{league.name}</h3>
                        <p className="text-sm text-gray-300 font-exo2">
                          {league.league_members_count || 0} Jugadores
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div
            className="animate-rotate-border rounded-xl p-0.5"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #f59e0b 20deg, #d4af37 30deg, #f59e0b 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '3s',
            }}
          >
            <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-semibold text-white mb-4 font-exo2">Crear Nueva Liga</h2>
              <form onSubmit={handleCreateLeague}>
                <label className="block text-gray-300 mb-2 font-exo2">Nombre de la Liga</label>
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white mb-4 font-exo2"
                  placeholder="Ingresa el nombre de la liga"
                  required
                  aria-label="Nombre de la Liga"
                />
                <label className="block text-gray-300 mb-2 font-exo2">Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white mb-4 font-exo2"
                  placeholder="Describe tu liga"
                  aria-label="Descripción"
                />
                <label className="block text-gray-300 mb-2 font-exo2">Imagen de Perfil (opcional)</label>
                <div
                  {...getRootPropsCreate()}
                  className={`p-4 border-2 border-dashed rounded-lg text-center mb-4 ${
                    isDragActiveCreate ? 'border-cyan-400 bg-cyan-900/20' : 'border-gray-500 bg-gray-700'
                  }`}
                >
                  <input {...getInputPropsCreate()} />
                  {profileImage ? (
                    <div className="flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full overflow-hidden">
                        <Image
                          src={URL.createObjectURL(profileImage)}
                          alt="Vista previa del perfil"
                          width={64}
                          height={64}
                          className="object-cover w-full h-full"
                        />
                      </div>
                      <button
                        onClick={() => setProfileImage(null)}
                        className="ml-2 text-red-400 hover:text-red-300"
                        aria-label="Eliminar imagen"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-300 font-exo2">Arrastra y suelta una imagen (máx. 2MB), o haz clic para seleccionar</p>
                  )}
                </div>
                <label className="block text-gray-300 mb-2 font-exo2">Contraseña de Unión</label>
                <input
                  type="text"
                  value={joinPassword}
                  onChange={(e) => setJoinPassword(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white mb-4 font-exo2"
                  placeholder="Elige una contraseña para unirse"
                  required
                  aria-label="Contraseña de Unión"
                />
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(251,191,36,0.7)' }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={myLeaguesLoading}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-full font-exo2 font-semibold transition-all disabled:opacity-50"
                  aria-label="Crear Liga"
                >
                  {myLeaguesLoading ? 'Creando...' : 'Crear Liga'}
                </motion.button>
              </form>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div
            className="animate-rotate-border rounded-xl p-0.5"
            style={{
              background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #22d3ee 20deg, #0d9488 30deg, #22d3ee 40deg, transparent 50deg, transparent 360deg)`,
              animationDuration: '5s',
            }}
          >
            <div className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-semibold text-white mb-4 font-exo2">Unirse a una Liga</h2>
              <form onSubmit={handleJoinLeague}>
                <label className="block text-gray-300 mb-2 font-exo2">Contraseña de Unión</label>
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  className="w-full p-2 rounded bg-gray-700 text-white mb-4 font-exo2"
                  placeholder="Ingresa la contraseña de unión"
                  required
                  aria-label="Contraseña de Unión"
                />
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 10px rgba(34,211,238,0.7)' }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={myLeaguesLoading}
                  className="w-full py-3 bg-gradient-to-r from-amber-400 to-cyan-400 text-white rounded-full font-exo2 font-semibold transition-all disabled:opacity-50"
                  aria-label="Unirse a la Liga"
                >
                  {myLeaguesLoading ? 'Uniéndose...' : 'Unirse a la Liga'}
                </motion.button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>

      {showInviteModal && (
        <InviteFriendsModal
          leagueId={showInviteModal.leagueId}
          joinPassword={showInviteModal.joinPassword}
          onClose={() => setShowInviteModal(null)}
        />
      )}
      {showManageModal && (
        <ManageLeagueModal league={showManageModal} onClose={() => setShowManageModal(null)} />
      )}
    </div>
  );
}