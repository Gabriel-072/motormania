// 📁 components/QuickEntryButton.tsx
'use client';

import { useStickyStore } from '@/stores/stickyStore';
import { PickSelection } from '@/app/types/picks';
import { motion } from 'framer-motion';
import { FaBolt } from 'react-icons/fa';

type QuickEntryButtonProps = {
  qualyLines: any[];
  raceLines: any[];
  qualyEnabled: boolean;
  raceEnabled: boolean;
  onOpen: () => void;
};

export default function QuickEntryButton({
  qualyLines,
  raceLines,
  qualyEnabled,
  raceEnabled,
  onOpen,
}: QuickEntryButtonProps) {
  const { setQualyPicks, setRacePicks } = useStickyStore();

  // Fisher–Yates shuffle para muestreo sin reemplazo
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const handleQuickEntry = () => {
    setQualyPicks([]);
    setRacePicks([]);

    const TOTAL_PICKS = 8;
    const MAX_QUALY = 4;

    // Filtrar según disponibilidad
    const availableQualy = qualyEnabled ? qualyLines : [];
    const availableRace  = raceEnabled  ? raceLines  : [];

    // Calcular cuántos picks de cada uno
    const numQualy = Math.min(availableQualy.length, MAX_QUALY);
    const numRace  = TOTAL_PICKS - numQualy;

    // Tomar sin repeticiones
    const selectedQualy = shuffle(availableQualy).slice(0, numQualy);
    const selectedRace  = shuffle(availableRace).slice(0, numRace);

    // Construir PickSelection con mejor/peor
    const newQualyPicks: PickSelection[] = selectedQualy.map(line => ({
      ...line,
      session_type: 'qualy',
      betterOrWorse: Math.random() > 0.5 ? 'mejor' : 'peor',
    }));

    const newRacePicks: PickSelection[] = selectedRace.map(line => ({
      ...line,
      session_type: 'race',
      betterOrWorse: Math.random() > 0.5 ? 'mejor' : 'peor',
    }));

    setQualyPicks(newQualyPicks);
    setRacePicks(newRacePicks);
    onOpen();
  };

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={handleQuickEntry}
      className="
        flex items-center gap-1
        rounded-lg bg-amber-400 px-3 py-1.5
        font-bold text-black shadow-md
        hover:shadow-amber-400/40
        transition active:scale-95
      "
    >
      <FaBolt className="text-sm" />
      ¡Jugar Ya!
    </motion.button>
  );
}