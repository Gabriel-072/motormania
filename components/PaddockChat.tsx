'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { createAuthClient } from '@/lib/supabase';
import { RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Upload } from 'lucide-react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';

type Message = {
  id: string;
  user_id: string;
  username: string;
  message: string;
  created_at: string;
  reactions: { [key: string]: string[] };
  profile_image_url?: string;
};

const gf = new GiphyFetch('XqgeFCx17Q9jlWHRdA1Jw7a8kiknDhQ9');

const PaddockChat = () => {
  const { isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showReportModal, setShowReportModal] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [showGifModal, setShowGifModal] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef<boolean>(false);
  const messageCountRef = useRef<number>(0);
  const lastResetRef = useRef<number>(Date.now());

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

    if (isToday) return `Hoy a las ${format(date, 'h:mm a', { locale: es })}`;
    if (isYesterday) return `Ayer a las ${format(date, 'h:mm a', { locale: es })}`;
    return format(date, "d 'de' MMMM 'a las' h:mm a", { locale: es });
  };

  useEffect(() => {
    if (!isLoaded || !user?.id) {
      setLoading(false);
      return;
    }

    let channel: any = null;

    const setupChat = async () => {
      try {
        const token = await getToken({ template: 'supabase' });
        if (!token) throw new Error('No se pudo obtener el token de autenticación');
        const supabase = createAuthClient(token);

        const { data: predictionsData, error: predError } = await supabase
          .from('predictions')
          .select('user_id')
          .eq('user_id', user.id);
        if (predError) throw predError;
        if (!predictionsData?.length) {
          setError('Debes enviar una predicción para unirte al chat del Paddock.');
          setLoading(false);
          return;
        }

        const { data: messagesData, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id, user_id, username, message, created_at, reactions')
          .order('created_at', { ascending: true });
        if (messagesError) throw messagesError;

        let userMap = new Map<string, string | undefined>();
        try {
          const userIds = [...new Set(messagesData.map((msg: any) => msg.user_id))];
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds }),
          });
          if (!response.ok) throw new Error('Failed to fetch user data from Clerk');
          const usersData: { id: string; profileImageUrl?: string }[] = await response.json();
          userMap = new Map(usersData.map((u) => [u.id, u.profileImageUrl]));
        } catch (apiErr) {
          console.warn('Falling back to no profile images:', apiErr);
        }

        const initialMessages: Message[] = messagesData.map((msg: any) => ({
          id: msg.id,
          user_id: msg.user_id,
          username: msg.username,
          message: msg.message,
          created_at: msg.created_at,
          reactions: msg.reactions || { '🏁': [], '😃': [], '😭': [], '😡': [] },
          profile_image_url: userMap.get(msg.user_id),
        }));
        setMessages(initialMessages);
        scrollToBottom();
      } catch (err: any) {
        setError(`Error al inicializar el chat: ${err.message}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    setupChat();

    return () => {
      if (channel) {
        channel.unsubscribe();
        console.log('Subscription cleaned up');
      }
    };
  }, [isLoaded, user?.id, getToken]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content?: string) => {
    if (!user?.id || sendingRef.current) {
      console.log('Cannot send: No user or already sending');
      return;
    }

    const now = Date.now();
    if (now - lastResetRef.current >= 60 * 1000) {
      messageCountRef.current = 0;
      lastResetRef.current = now;
    }
    if (messageCountRef.current >= 5) {
      setError('Límite de mensajes alcanzado. Espera un minuto.');
      console.log('Rate limit hit');
      return;
    }
    messageCountRef.current++;

    sendingRef.current = true;
    let tempId = `temp-${Date.now()}`;
    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación');
      const supabase = createAuthClient(token);

      let messageContent = content || newMessage.trim();
      console.log('Sending message content:', messageContent);

      if (imageFile) {
        if (imageFile.size > 2 * 1024 * 1024) throw new Error('La imagen no debe exceder 2MB.');
        const fileName = `${user.id}/${Date.now()}-${imageFile.name.replace(/\s+/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(fileName, imageFile);
        if (uploadError) throw new Error(`Error al subir imagen: ${uploadError.message}`);
        const { data } = supabase.storage.from('chat-images').getPublicUrl(fileName);
        messageContent = data.publicUrl;
        setImageFile(null);
      } else if (!messageContent) {
        console.log('No message content to send');
        return;
      }

      const optimisticMessage: Message = {
        id: tempId,
        user_id: user.id,
        username: user.username || user.fullName || 'Usuario',
        message: messageContent,
        created_at: new Date().toISOString(),
        reactions: { '🏁': [], '😃': [], '😭': [], '😡': [] },
        profile_image_url: user.imageUrl,
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          username: user.username || user.fullName || 'Usuario',
          message: messageContent,
          reactions: { '🏁': [], '😃': [], '😭': [], '😡': [] },
        })
        .select()
        .single();
      if (error) throw error;

      console.log('Message sent successfully:', data);
      setMessages((prev) => prev.map((msg) => (msg.id === tempId ? { ...data, profile_image_url: user.imageUrl } : msg)));
      setNewMessage('');
    } catch (err: any) {
      setError(`Error al enviar mensaje: ${err.message}`);
      console.error('Send message error:', err);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      sendingRef.current = false;
    }
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    if (!user?.id) return;

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación');
      const supabase = createAuthClient(token);

      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      const currentReactions = message.reactions || { '🏁': [], '😃': [], '😭': [], '😡': [] };
      const userReactions = currentReactions[reaction] || [];
      const hasReacted = userReactions.includes(user.id);

      const updatedReactions = {
        ...currentReactions,
        [reaction]: hasReacted
          ? userReactions.filter((id) => id !== user.id)
          : [...userReactions, user.id],
      };

      const { error } = await supabase
        .from('chat_messages')
        .update({ reactions: updatedReactions })
        .eq('id', messageId);
      if (error) throw error;

      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg))
      );
    } catch (err: any) {
      setError(`Error al añadir reacción: ${err.message}`);
      console.error(err);
    }
  };

  const handleReport = async (messageId: string) => {
    if (!user?.id || !reportReason.trim()) return;

    try {
      const token = await getToken({ template: 'supabase' });
      if (!token) throw new Error('No se pudo obtener el token de autenticación');
      const supabase = createAuthClient(token);

      const { error } = await supabase
        .from('message_reports')
        .insert({
          message_id: messageId,
          user_id: user.id,
          reason: reportReason.trim(),
        });
      if (error) throw error;

      setShowReportModal(null);
      setReportReason('');
      setError(null);
    } catch (err: any) {
      setError(`Error al reportar mensaje: ${err.message}`);
      console.error(err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImageFile(file);
  };

  const fetchGifs = (offset: number) =>
    gf.search(gifSearch.trim() || 'reaction', { offset, limit: 10 });

  const handleSendGif = async (gif: any) => {
    const gifUrl = gif.images.fixed_height.url;
    console.log('Selected GIF URL:', gifUrl);
    await handleSendMessage(gifUrl);
    setShowGifModal(false);
  };

  if (loading) return <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white font-exo2 flex items-center justify-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900 text-white p-4 sm:p-8 overflow-hidden">
      <motion.h1
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-cyan-400 to-purple-400 mb-6 tracking-wider font-exo2 text-center"
      >
        Paddock Chat
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

      <div
        className="animate-rotate-border rounded-xl p-0.5 max-w-3xl mx-auto"
        style={{
          background: `conic-gradient(from var(--border-angle), transparent 0deg, transparent 10deg, #9333ea 20deg, #c084fc 30deg, #9333ea 40deg, transparent 50deg, transparent 360deg)`,
          animationDuration: '6s',
        }}
      >
        <div className="bg-gradient-to-br from-gray-900 to-black p-4 rounded-xl shadow-lg h-[70vh] flex flex-col">
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto space-y-4 px-2 custom-scrollbar"
          >
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className={`flex items-start space-x-3 p-3 rounded-lg shadow-md max-w-[80%] ${
                  msg.user_id === user?.id ? 'bg-amber-900/70' : 'bg-gray-800'
                }`}
              >
                {msg.profile_image_url ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={msg.profile_image_url}
                      alt={msg.username}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-exo2 flex-shrink-0">
                    {msg.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-baseline space-x-2">
                    <span
                      className={`font-exo2 font-semibold ${
                        msg.user_id === user?.id ? 'text-amber-300' : 'text-blue-400'
                      }`}
                    >
                      {msg.username}
                    </span>
                    <span className="text-gray-400 text-xs italic font-exo2">
                      {formatTimestamp(msg.created_at)}
                    </span>
                  </div>
                  {msg.message.startsWith('http') && (msg.message.includes('giphy.com') || msg.message.includes('.gif')) ? (
                    <Image
                      src={msg.message.split('?')[0]}
                      alt="Chat GIF"
                      width={200}
                      height={200}
                      className="rounded-lg mt-2 max-w-full h-auto"
                      unoptimized
                    />
                  ) : (
                    <p className="text-white font-exo2 mt-1">{msg.message}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-2">
                    {['🏁', '😃', '😭', '😡'].map((emoji) => {
                      const reactors = msg.reactions[emoji] || [];
                      const hasReacted = reactors.includes(user?.id || '');
                      return (
                        <motion.button
                          key={emoji}
                          whileHover={{ scale: 1.2, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className={`text-sm px-1 rounded ${hasReacted ? 'text-amber-400' : 'text-gray-400'} hover:text-amber-300`}
                        >
                          {emoji} {reactors.length > 0 ? reactors.length : ''}
                        </motion.button>
                      );
                    })}
                    <button
                      onClick={() => setShowReportModal(msg.id)}
                      className="text-gray-400 text-xs hover:text-red-400 font-exo2 ml-2"
                    >
                      Reportar
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4 flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Escribe un mensaje o sube una imagen/GIF..."
              className="flex-1 p-2 rounded-full bg-gray-700 text-white font-exo2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <label className="p-2 bg-gray-600 rounded-full text-white hover:bg-gray-500 transition cursor-pointer">
              <Upload className="w-5 h-5" />
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowGifModal(true)}
              className="p-2 bg-gray-600 rounded-full text-white hover:bg-gray-500 transition font-exo2 text-sm"
              aria-label="Enviar GIF"
            >
              GIF
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSendMessage()}
              className="p-2 bg-cyan-600 rounded-full text-white hover:bg-cyan-700 transition"
              aria-label="Enviar mensaje"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </motion.button>
          </div>
        </div>
      </div>

      {showReportModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowReportModal(null)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-4 font-exo2">Reportar Mensaje</h2>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Describe el problema..."
              className="w-full p-2 rounded bg-gray-700 text-white mb-4 font-exo2"
            />
            <div className="flex space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleReport(showReportModal)}
                className="flex-1 py-2 bg-red-600 text-white rounded font-exo2 hover:bg-red-700 transition"
              >
                Enviar Reporte
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowReportModal(null)}
                className="flex-1 py-2 bg-gray-700 text-white rounded font-exo2 hover:bg-gray-600 transition"
              >
                Cancelar
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showGifModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowGifModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-4 font-exo2">Seleccionar GIF</h2>
            <input
              type="text"
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                }
              }}
              placeholder="Buscar GIFs..."
              className="w-full p-2 mb-4 rounded bg-gray-700 text-white font-exo2 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
            <Grid
              width={400}
              columns={2}
              gutter={6}
              fetchGifs={fetchGifs}
              onGifClick={(gif, e) => {
                e.preventDefault();
                handleSendGif(gif);
              }}
              key={gifSearch}
            />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default PaddockChat;