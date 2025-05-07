// 📁 components/ActionButton.tsx
'use client';

import { ReactNode } from 'react';

interface Props {
  title : string;
  icon  : ReactNode;
  color : 'amber' | 'cyan';
  onClick: () => void;
}

export default function ActionButton({ title, icon, color, onClick }:Props) {
  const bg  = color==='amber' ? 'bg-amber-500 hover:bg-amber-600 text-black'
                              : 'bg-cyan-500 hover:bg-cyan-600 text-black';
  return (
    <button
      onClick={onClick}
      className={`${bg} flex flex-col items-center justify-center gap-2 py-4 rounded-xl font-semibold`}
    >
      <span className="text-xl">{icon}</span>
      <span>{title}</span>
    </button>
  );
}