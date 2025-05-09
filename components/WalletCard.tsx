// 📁 components/WalletCard.tsx
'use client';

import Image from 'next/image';
import { FaLock, FaCoins, FaBolt } from 'react-icons/fa';

interface Props {
  balanceCop   : number;
  withdrawable : number;
  fuel         : number;
  lockedFuel   : number;
  mmc          : number;
  lockedMmc    : number;
}

// Formatter for Colombian Pesos (COP)
const fmtCop = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(n);

// General number formatter
const fmtNum = (n: number) => n.toLocaleString('es-CO');

export default function WalletCard({
  balanceCop,
  withdrawable,
  fuel,
  lockedFuel,
  mmc,
  lockedMmc,
}: Props) {
  const totalFuel = fuel + lockedFuel;
  const totalMmc  = mmc + lockedMmc;

  return (
    <div className="relative bg-gradient-to-br from-gray-800/70 via-black/50 to-gray-900/70 rounded-xl p-6 shadow-xl text-white font-exo2 antialiased max-w-md mx-auto border border-gray-700/50">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        {/* Asegúrate que la ruta a /logo.png sea correcta y el logo se vea bien en fondos oscuros */}
        <Image src="/logo.png" alt="MMC GO Wallet" width={84} height={28} className="opacity-90" />

        <div className="text-right space-y-1.5">
          <span
            className="inline-block bg-green-600/30 text-green-300 text-xs font-semibold px-3 py-1 rounded-full shadow-sm hover:bg-green-600/40 transition-colors cursor-default"
            role="status"
            aria-label={`Saldo retirable ${fmtCop(withdrawable)}`}
          >
            {fmtCop(withdrawable)} Retirable
          </span>
          {(lockedFuel > 0 || lockedMmc > 0) && (
            <span
              className="inline-flex items-center bg-yellow-500/30 text-yellow-300 text-xs font-semibold px-3 py-1 rounded-full shadow-sm ml-2 cursor-default hover:bg-yellow-500/40 transition-colors"
              role="status"
              aria-label={`Tienes ${lockedFuel} FC y ${lockedMmc} MMC bloqueados`}
            >
              <FaLock className="h-3 w-3 mr-1.5" />
              Bloqueado
            </span>
          )}
        </div>
      </div>

      {/* Total Balance */}
      <div className="mb-8 text-center">
        <p className="text-sm text-gray-400 uppercase tracking-wider font-medium"> {/* Cambiado de text-blue-200 a text-gray-400 */}
          Balance Total (COP)
        </p>
        <h1 className="text-5xl font-bold tracking-tight text-white mt-1">
          {fmtCop(balanceCop)}
        </h1>
      </div>

      {/* Breakdown */}
      <div className="space-y-5">
        {/* Fuel Coins */}
        <div className="bg-black/30 hover:bg-black/40 transition-colors p-4 rounded-lg shadow-md"> {/* Fondo más oscuro y sutil */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <FaBolt className="h-5 w-5 text-amber-400 mr-2.5" />
              <h3 className="text-lg font-semibold text-amber-300">Fuel Coins (FC)</h3> {/* Color ámbar consistente con MMCGo */}
            </div>
            <span className="text-xl font-bold text-amber-300">{fmtNum(totalFuel)}</span>
          </div>
          <div className="text-sm space-y-1 pl-7">
            <div className="flex justify-between items-center text-gray-300"> {/* Cambiado de text-blue-100 a text-gray-300 */}
              <span>Disponible:</span>
              <span className="font-medium">{fmtNum(fuel)}</span>
            </div>
            {lockedFuel > 0 && (
              <div className="flex justify-between items-center text-yellow-300/90">
                <span className="inline-flex items-center">
                  <FaLock className="inline h-3 w-3 mr-1 opacity-70" />
                  Bloqueado:
                </span>
                <span className="font-medium">+{fmtNum(lockedFuel)}</span>
              </div>
            )}
          </div>
        </div>

        {/* MMC Coins */}
        <div className="bg-black/30 hover:bg-black/40 transition-colors p-4 rounded-lg shadow-md"> {/* Fondo más oscuro y sutil */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <FaCoins className="h-5 w-5 text-cyan-400 mr-2.5" /> {/* Color cian consistente con MMCGo */}
              <h3 className="text-lg font-semibold text-cyan-300">MMC Coins</h3> {/* Color cian */}
            </div>
            <span className="text-xl font-bold text-cyan-300">{fmtNum(totalMmc)}</span>
          </div>
          <div className="text-sm space-y-1 pl-7">
            <div className="flex justify-between items-center text-gray-300"> {/* Cambiado de text-blue-100 a text-gray-300 */}
              <span>Disponible:</span>
              <span className="font-medium">{fmtNum(mmc)}</span>
            </div>
            {lockedMmc > 0 && (
              <div className="flex justify-between items-center text-yellow-300/90">
                <span className="inline-flex items-center">
                  <FaLock className="inline h-3 w-3 mr-1 opacity-70" />
                  Bloqueado:
                </span>
                <span className="font-medium">+{fmtNum(lockedMmc)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}