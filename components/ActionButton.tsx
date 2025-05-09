// 📁 components/ActionButton.tsx
'use client';

import React from 'react';

export interface Props {
  title: string;
  icon: React.ReactNode;
  color: 'amber' | 'cyan' | 'emerald';
  onClick: () => void;
  className?: string;  // Permite clases adicionales
}

export default function ActionButton({
  title,
  icon,
  color,
  onClick,
  className = ''
}: Props) {

  // Configuraciones de color específicas para cada variante del botón
  const colorConfig = { // <--- ESTA ES LA NUEVA CONFIGURACIÓN CON GRADIENTES
    amber: {
      gradient: 'from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600',
      text: 'text-black',
      shadow: 'shadow-orange-600/30 hover:shadow-orange-600/40',
      focusRing: 'focus-visible:ring-orange-500'
    },
    cyan: {
      gradient: 'from-cyan-400 to-sky-500 hover:from-cyan-500 hover:to-sky-600',
      text: 'text-white',
      shadow: 'shadow-sky-600/30 hover:shadow-sky-600/40',
      focusRing: 'focus-visible:ring-sky-500'
    },
    emerald: {
      gradient: 'from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600',
      text: 'text-white',
      shadow: 'shadow-green-600/30 hover:shadow-green-600/40',
      focusRing: 'focus-visible:ring-green-500'
    },
  }[color];

  // Clases base para todos los botones de acción
  const baseClasses = `
    w-full flex items-center justify-center gap-x-2 sm:gap-x-2.5
    py-3 px-4 rounded-xl font-semibold
    transition-all duration-200 ease-out
    transform hover:-translate-y-0.5
    active:scale-95 active:translate-y-0
    shadow-lg hover:shadow-xl
    focus:outline-none
    focus-visible:ring-2 focus-visible:ring-offset-2
    focus-visible:ring-offset-gray-900
  `;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        ${baseClasses}
        bg-gradient-to-br ${colorConfig.gradient}  // Aplicar gradiente diagonal
        ${colorConfig.text}
        ${colorConfig.shadow}
        ${colorConfig.focusRing}
        ${className}
      `}
    >
      <span className="shrink-0 text-base sm:text-lg">{icon}</span>
      <span className="text-sm sm:text-base">{title}</span>
    </button>
  );
}