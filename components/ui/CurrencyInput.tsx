// 📁 components/ui/CurrencyInput.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useCurrencyStore, useCurrencyInfo } from '@/stores/currencyStore';

interface CurrencyInputProps {
  copValue: number;
  onCOPChange: (copAmount: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number; // in COP
  max?: number; // in COP
  step?: number; // in COP
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  copValue,
  onCOPChange,
  className = '',
  placeholder,
  disabled = false,
  min = 20000,
  max,
  step = 1000,
}) => {
  const { convertFromCOP, convertToCOP } = useCurrencyStore();
  const { currencyInfo } = useCurrencyInfo();
  
  // Convert COP values to display currency
  const displayValue = convertFromCOP(copValue);
  const displayMin = convertFromCOP(min);
  const displayMax = max ? convertFromCOP(max) : undefined;
  const displayStep = convertFromCOP(step);
  
  // Internal state for display value to handle formatting
  const [inputValue, setInputValue] = useState(
    displayValue.toFixed(currencyInfo.decimals)
  );
  
  // Update input when copValue changes externally
  useEffect(() => {
    const newDisplayValue = convertFromCOP(copValue);
    setInputValue(newDisplayValue.toFixed(currencyInfo.decimals));
  }, [copValue, convertFromCOP, currencyInfo.decimals]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    const numericValue = parseFloat(value) || 0;
    const copAmount = convertToCOP(numericValue);
    onCOPChange(copAmount);
  };
  
  const handleBlur = () => {
    // Re-format on blur to ensure proper decimal places
    const numericValue = parseFloat(inputValue) || 0;
    setInputValue(numericValue.toFixed(currencyInfo.decimals));
  };
  
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        {currencyInfo.symbol}
      </span>
      <input
        type="number"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        min={displayMin}
        max={displayMax}
        step={displayStep}
        className={`pl-8 ${className}`}
      />
      {currencyInfo.code !== 'USD' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
          {currencyInfo.code}
        </span>
      )}
    </div>
  );
};