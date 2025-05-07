// 📁 components/WalletCard.tsx
'use client';

import { FaLock } from 'react-icons/fa';

interface Props {
  balanceCop   : number;
  withdrawable : number;
  fuel         : number;
  lockedFuel   : number;
  mmc          : number;
  lockedMmc    : number;
}

const fmt = (n:number)=>n.toLocaleString('es-CO');

export default function WalletCard({
  balanceCop, withdrawable, fuel, lockedFuel, mmc, lockedMmc
}:Props) {
  return (
    <div className="relative bg-gradient-to-br from-cyan-700 to-blue-800 rounded-2xl p-5 shadow-lg">
      {/* logo */}
      <img src="/logo.svg" alt="MMC GO" className="h-5 opacity-80" />

      {/* balance main */}
      <p className="mt-6 text-gray-200 text-sm">Balance total</p>
      <h2 className="text-3xl font-extrabold text-white">${fmt(balanceCop)}</h2>

      {/* pill withdrawable */}
      <div className="absolute top-5 right-5 text-right space-y-1">
        <span className="bg-lime-500/10 text-lime-300 text-xs font-semibold px-2 py-0.5 rounded-full">
          ${fmt(withdrawable)} Retirable
        </span><br/>
        {lockedFuel > 0 && (
          <span className="text-yellow-300 text-xs flex items-center gap-0.5">
            <FaLock className="h-3 w-3"/>+{fmt(lockedFuel)} FC
          </span>
        )}
      </div>

      {/* breakdown */}
      <div className="mt-6 grid grid-cols-2 gap-4 text-xs text-gray-200">
        <div>
          <p className="uppercase tracking-wide text-[10px]">Fuel Coins</p>
          <p className="font-semibold text-amber-200">
            {fmt(fuel)} {lockedFuel>0 && <span className="text-yellow-400">(+{fmt(lockedFuel)})</span>}
          </p>
        </div>
        <div>
          <p className="uppercase tracking-wide text-[10px]">MMC Coins</p>
          <p className="font-semibold text-cyan-100">
            {fmt(mmc)} {lockedMmc>0 && <span className="text-yellow-400">(+{fmt(lockedMmc)})</span>}
          </p>
        </div>
      </div>
    </div>
  );
}