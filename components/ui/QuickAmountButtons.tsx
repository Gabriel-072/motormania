// 📁 components/ui/QuickAmountButtons.tsx
'use client';

import React from 'react';
import { CurrencyDisplay } from './CurrencyDisplay';

interface QuickAmountButtonsProps {
  onAmountAdd: (copAmount: number) => void;
  onClear: () => void;
  className?: string;
}

// Quick add amounts in COP (these will be converted for display)
const QUICK_AMOUNTS_COP = [10000, 20000, 50000, 100000];

export const QuickAmountButtons: React.FC<QuickAmountButtonsProps> = ({
  onAmountAdd,
  onClear,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap justify-center gap-2 ${className}`}>
      {QUICK_AMOUNTS_COP.map(copAmount => (
        <button 
          key={copAmount}
          onClick={() => onAmountAdd(copAmount)}
          className="px-3 py-1 rounded-full text-xs bg-gray-600 text-gray-200 hover:bg-gray-500 transition-colors"
        >
          +<CurrencyDisplay copAmount={copAmount} />
        </button>
      ))}
      <button 
        onClick={onClear}
        className="px-3 py-1 rounded-full text-xs bg-red-800 text-gray-200 hover:bg-red-700 transition-colors"
      >
        Clear
      </button>
    </div>
  );
};