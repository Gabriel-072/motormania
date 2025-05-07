// 📁 components/PlayThroughProgress.tsx
'use client';

interface Props {
  remaining : number;   // MMC que faltan
  total     : number;   // total exigido
}
export default function PlayThroughProgress({remaining,total}:Props){
  const pct = Math.min(100, Math.round(((total-remaining)/total)*100));
  return (
    <div className="mt-4">
      <p className="text-xs text-gray-300 mb-1">
        Juega <span className="font-semibold text-amber-400">{remaining}</span> MMC más
        para liberar tu bono
      </p>
      <div className="w-full h-2 bg-gray-700/60 rounded-full overflow-hidden">
        <div
          style={{ width:`${pct}%` }}
          className="h-full bg-emerald-400 transition-all duration-300"
        />
      </div>
    </div>
  );
}