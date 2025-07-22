// 📁 components/ui/CurrencyDisplay.tsx
'use client';

import React from 'react';
import { useCurrencyConverter } from '@/stores/currencyStore';

interface CurrencyDisplayProps {
  copAmount: number;
  className?: string;
  showCode?: boolean;
  showFlag?: boolean;
  prefix?: string;
  suffix?: string;
}

export const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({
  copAmount,
  className = '',
  showCode = false,
  showFlag = false,
  prefix = '',
  suffix = '',
}) => {
  const { formatAmount } = useCurrencyConverter();
  
  const formattedAmount = formatAmount(copAmount, { showCode, showFlag });
  
  return (
    <span className={className}>
      {prefix}{formattedAmount}{suffix}
    </span>
  );
};