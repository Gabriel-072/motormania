// components/ScoringSystemModal.tsx
'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline'; // ← Import corregido

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ScoringSystemModal({ isOpen, onClose }: Props) {
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="fixed inset-0 z-50 overflow-y-auto" 
        onClose={onClose}
      >
        <div className="flex items-end justify-center min-h-screen px-4 pb-20 text-center sm:block sm:p-0">
          {/* Fondo semitransparente reemplazando a Dialog.Overlay */}
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
              className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" 
              aria-hidden="true" 
            />
          </Transition.Child>

          {/* Truco para centrar verticalmente en pantallas sm+ */}
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
            <div className="inline-block align-bottom bg-neutral-900 rounded-lg px-6 pt-5 pb-6 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              {/* Título + Botón Cerrar */}
              <div className="flex justify-between items-center mb-4">
                <Dialog.Title 
                  as="h3" 
                  className="text-lg font-semibold leading-6 text-white font-exo2"
                >
                  Sistema de Puntuación
                </Dialog.Title>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-200 focus:outline-none"
                  onClick={onClose}
                >
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              {/* Cuerpo con explicación */}
              <div className="mt-2 text-sm text-gray-200 space-y-4 font-exo2">
                <p>
                  El puntaje de cada Gran Premio se divide en tres secciones: 
                  <strong className="text-white"> Pole, Podio y Extras</strong>, con los siguientes valores:
                </p>
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    <strong>Pole Position (Calificación):</strong>
                    <ul className="list-decimal list-inside ml-6 space-y-1">
                      <li>
                        Acertar la pole exacta (p1, p2, p3):{' '}
                        <span className="text-amber-400 font-semibold">5 puntos</span> cada posición exacta.
                      </li>
                      <li>
                        Si tu piloto está dentro del Top 3, pero no en la posición exacta:{' '}
                        <span className="text-amber-300 font-semibold">2 puntos</span>.
                      </li>
                      <li>
                        Bono de <span className="text-amber-500 font-semibold">+10 puntos</span> 
                        si aciertas las tres posiciones de pole (p1, p2 y p3) EXACTAS.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <strong>Podio de Carrera:</strong>
                    <ul className="list-decimal list-inside ml-6 space-y-1">
                      <li>
                        Acertar el ganador (gp1), segundo (gp2) o tercer lugar (gp3) EXACTOS:{' '}
                        <span className="text-blue-400 font-semibold">8 puntos</span> c/u.
                      </li>
                      <li>
                        Si tu piloto está en el Top 3, pero no en la posición exacta:{' '}
                        <span className="text-blue-300 font-semibold">3 puntos</span>.
                      </li>
                      <li>
                        Bono de <span className="text-blue-500 font-semibold">+10 puntos</span> 
                        si aciertas las tres posiciones del podio (gp1, gp2, gp3) EXACTAS.
                      </li>
                    </ul>
                  </li>
                  <li>
                    <strong>Extras (Micro-predicciones):</strong>
                    <ul className="list-decimal list-inside ml-6 space-y-1">
                      <li>
                        Equipo con <em>pit stop</em> más rápido:{' '}
                        <span className="text-green-400 font-semibold">5 puntos</span> si aciertas.
                      </li>
                      <li>
                        Piloto con vuelta rápida:{' '}
                        <span className="text-green-300 font-semibold">5 puntos</span>.
                      </li>
                      <li>
                        “Piloto del Día”:{' '}
                        <span className="text-purple-400 font-semibold">5 puntos</span>.
                      </li>
                      <li>
                        Primer equipo en pits:{' '}
                        <span className="text-teal-400 font-semibold">5 puntos</span>.
                      </li>
                      <li>
                        Primer piloto en retirarse:{' '}
                        <span className="text-red-400 font-semibold">10 puntos</span>.
                      </li>
                    </ul>
                  </li>
                </ul>
                <p className="mt-4">
                  <span className="font-semibold">Total</span> de cada GP = Suma de Pole + Podio + Extras.  
                  Ejemplo: si aciertas 2 posiciones exactas de pole (2×5=10), 1 posición del podio exacta (8) 
                  y aciertas equipo de vuelta rápida (5), tu total sería{' '}
                  <span className="text-white font-semibold">10 + 8 + 5 = 23 puntos</span>.
                </p>
                <p>
                  Si existiera la coincidencia de “todas las posiciones EXACTAS” en pole <em>y</em> podio 
                  (6 posiciones correctas entre p1, p2, p3 y gp1, gp2, gp3), recibirías dos bonos de +10 
                  (uno para pole completa y otro para podio completa), sumando{' '}
                  <span className="text-white font-semibold">+20 puntos</span> adicionales.
                </p>
              </div>

              {/* Botón de cerrar al final (opc.) */}
              <div className="mt-6 text-right">
                <button
                  type="button"
                  className="inline-flex justify-center rounded-md border border-transparent 
                                 bg-amber-500 px-4 py-2 text-sm font-medium text-white 
                                 hover:bg-amber-600 focus:outline-none focus:ring-2 
                                 focus:ring-amber-400 focus:ring-offset-2"
                  onClick={onClose}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
}