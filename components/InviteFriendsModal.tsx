'use client';

import { motion } from 'framer-motion';

interface InviteFriendsModalProps {
  leagueId: string;
  joinPassword: string;
  onClose: () => void;
}

export default function InviteFriendsModal({ leagueId, joinPassword, onClose }: InviteFriendsModalProps) {
  const joinLink = `${window.location.origin}/ligas-fantasy/join/${leagueId}`;
  const invitationMessage = `¡Únete a mi liga en MotorManía 🏁🏎️💨! Haz clic aquí: ${joinLink} y usa el código "${joinPassword}" para unirte.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invitationMessage);
      alert('Mensaje copiado al portapapeles');
    } catch (error) {
      console.error('Error al copiar el mensaje:', error);
      alert('Error al copiar el mensaje');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Invitación a mi liga en MotorManía',
          text: invitationMessage,
          url: joinLink,
        });
      } catch (error) {
        console.error('Error compartiendo la liga:', error);
        alert('Error al compartir la liga');
      }
    } else {
      alert('El compartido nativo no es soportado en este dispositivo');
    }
  };

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
        className="bg-gradient-to-br from-gray-900 to-black p-6 rounded-xl border border-amber-500/30 shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-4 font-exo2">Invitar Amigos</h2>
        <p className="text-gray-300 mb-4 font-exo2 text-sm">
          Comparte este mensaje para invitar a tus amigos:
        </p>
        <div className="p-4 bg-gray-800 rounded-lg text-sm text-white font-mono mb-4">
          {invitationMessage}
        </div>
        <div className="flex space-x-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            className="flex-1 py-2 bg-blue-600 text-white rounded font-exo2 hover:bg-blue-700 transition"
            aria-label="Copiar invitación"
          >
            Copiar
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleShare}
            className="flex-1 py-2 bg-green-600 text-white rounded font-exo2 hover:bg-green-700 transition"
            aria-label="Compartir invitación"
          >
            Compartir
          </motion.button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-gray-700 text-white rounded font-exo2 hover:bg-gray-600 hover:text-amber-400 transition"
          aria-label="Cerrar modal"
        >
          Cerrar
        </button>
      </motion.div>
    </motion.div>
  );
}