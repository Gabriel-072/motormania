// components/ScoringSystemModal.tsx
'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScoringSystemModal({ isOpen, onClose }: Props) {
  const scoringCategories = [
    {
      title: 'Pole Position',
      subtitle: 'Calificación',
      icon: '🏁',
      color: 'from-amber-500 to-yellow-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      rules: [
        {
          text: 'Acertar la pole exacta (p1, p2, p3):',
          points: '5 puntos',
          pointsColor: 'text-amber-400',
          description: 'cada posición exacta'
        },
        {
          text: 'Si tu piloto está dentro del Top 3, pero no en la posición exacta:',
          points: '2 puntos',
          pointsColor: 'text-amber-300'
        },
        {
          text: 'Bono si aciertas las tres posiciones de pole (p1, p2 y p3) EXACTAS:',
          points: '+10 puntos',
          pointsColor: 'text-amber-500',
          isBonus: true
        }
      ]
    },
    {
      title: 'Podio de Carrera',
      subtitle: 'Posiciones finales',
      icon: '🏆',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      rules: [
        {
          text: 'Acertar el ganador (gp1), segundo (gp2) o tercer lugar (gp3) EXACTOS:',
          points: '8 puntos',
          pointsColor: 'text-blue-400',
          description: 'cada uno'
        },
        {
          text: 'Si tu piloto está en el Top 3, pero no en la posición exacta:',
          points: '3 puntos',
          pointsColor: 'text-blue-300'
        },
        {
          text: 'Bono si aciertas las tres posiciones del podio (gp1, gp2, gp3) EXACTAS:',
          points: '+10 puntos',
          pointsColor: 'text-blue-500',
          isBonus: true
        }
      ]
    },
    {
      title: 'Extras',
      subtitle: 'Micro-predicciones',
      icon: '⭐',
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      rules: [
        {
          text: 'Equipo con pit stop más rápido:',
          points: '5 puntos',
          pointsColor: 'text-green-400'
        },
        {
          text: 'Piloto con vuelta rápida:',
          points: '5 puntos',
          pointsColor: 'text-green-300'
        },
        {
          text: '"Piloto del Día":',
          points: '5 puntos',
          pointsColor: 'text-purple-400'
        },
        {
          text: 'Primer equipo en pits:',
          points: '5 puntos',
          pointsColor: 'text-teal-400'
        },
        {
          text: 'Primer piloto en retirarse:',
          points: '10 puntos',
          pointsColor: 'text-red-400'
        }
      ]
    }
  ];

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="fixed inset-0 z-50 overflow-y-auto" 
        onClose={onClose}
      >
        <div className="flex items-center justify-center min-h-screen px-4 py-6 text-center sm:block sm:p-0">
          {/* Enhanced backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div 
              className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" 
              aria-hidden="true" 
            />
          </Transition.Child>

          <span 
            className="hidden sm:inline-block sm:align-middle sm:h-screen" 
            aria-hidden="true"
          >
            &#8203;
          </span>

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block align-bottom bg-gradient-to-br from-neutral-900/95 to-neutral-800/95 backdrop-blur-xl border border-neutral-700/50 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              {/* Decorative elements */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 via-transparent to-amber-500/5"></div>
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500"></div>
              
              <div className="relative px-8 py-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <Dialog.Title 
                      as="h3" 
                      className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent font-exo2 mb-1"
                    >
                      Sistema de Puntuación
                    </Dialog.Title>
                    <p className="text-neutral-400 font-exo2">
                      Descubre cómo se calculan los puntos en cada Gran Premio
                    </p>
                  </div>
                  <button
                    type="button"
                    className="group relative p-2 text-neutral-400 hover:text-white hover:bg-neutral-800/50 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    onClick={onClose}
                  >
                    <XMarkIcon className="h-6 w-6 group-hover:rotate-90 transition-transform duration-200" aria-hidden="true" />
                  </button>
                </div>

                {/* Introduction */}
                <div className="mb-8 p-6 bg-gradient-to-r from-neutral-800/50 to-neutral-700/50 rounded-xl border border-neutral-600/30">
                  <p className="text-neutral-200 font-exo2 text-lg leading-relaxed">
                    El puntaje de cada Gran Premio se divide en tres secciones principales: 
                    <span className="font-semibold text-amber-400"> Pole</span>, 
                    <span className="font-semibold text-blue-400"> Podio</span> y 
                    <span className="font-semibold text-green-400"> Extras</span>, 
                    cada una con sus propias reglas y valores.
                  </p>
                </div>

                {/* Scoring Categories */}
                <div className="space-y-6 mb-8">
                  {scoringCategories.map((category, index) => (
                    <div 
                      key={category.title}
                      className={`relative overflow-hidden ${category.bgColor} backdrop-blur-sm border ${category.borderColor} rounded-xl`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-5`}></div>
                      
                      <div className="relative p-6">
                        {/* Category Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="text-2xl">{category.icon}</div>
                          <div>
                            <h4 className="text-xl font-bold text-white font-exo2">
                              {category.title}
                            </h4>
                            <p className="text-sm text-neutral-400 font-exo2">
                              {category.subtitle}
                            </p>
                          </div>
                        </div>

                        {/* Rules */}
                        <div className="space-y-3">
                          {category.rules.map((rule, ruleIndex) => (
                            <div 
                              key={ruleIndex}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-800/30 rounded-lg border border-neutral-700/30 ${rule.isBonus ? 'ring-2 ring-orange-500/20' : ''}`}
                            >
                              <div className="flex-1 mb-2 sm:mb-0">
                                <p className="text-neutral-200 font-exo2 text-sm leading-relaxed">
                                  {rule.text}
                                  {rule.description && (
                                    <span className="text-neutral-400 text-xs block mt-1">
                                      {rule.description}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {rule.isBonus && (
                                  <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-semibold rounded-full">
                                    BONO
                                  </span>
                                )}
                                <span className={`${rule.pointsColor} font-bold text-lg font-exo2`}>
                                  {rule.points}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Example & Additional Info */}
                <div className="space-y-4 mb-8">
                  <div className="p-6 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-xl">
                    <h5 className="text-lg font-semibold text-white font-exo2 mb-3 flex items-center gap-2">
                      📊 Ejemplo de Cálculo
                    </h5>
                    <p className="text-neutral-200 font-exo2 leading-relaxed">
                      Si aciertas 2 posiciones exactas de pole (2×5=10), 1 posición del podio exacta (8) 
                      y aciertas equipo de vuelta rápida (5), tu total sería{' '}
                      <span className="px-2 py-1 bg-white/10 text-white font-bold rounded">
                        10 + 8 + 5 = 23 puntos
                      </span>
                    </p>
                  </div>

                  <div className="p-6 bg-gradient-to-r from-orange-900/20 to-yellow-900/20 border border-orange-500/20 rounded-xl">
                    <h5 className="text-lg font-semibold text-white font-exo2 mb-3 flex items-center gap-2">
                      🎯 Bono Máximo
                    </h5>
                    <p className="text-neutral-200 font-exo2 leading-relaxed">
                      Si aciertas TODAS las posiciones exactas en pole Y podio 
                      (6 posiciones correctas), recibirías dos bonos de +10 puntos, sumando{' '}
                      <span className="px-2 py-1 bg-orange-500/20 text-orange-400 font-bold rounded">
                        +20 puntos adicionales
                      </span>
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="group relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-exo2 font-semibold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                    onClick={onClose}
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center gap-2">
                      <span>Entendido</span>
                      <div className="w-5 h-5 rounded-full border-2 border-white/50 flex items-center justify-center">
                        ✓
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}