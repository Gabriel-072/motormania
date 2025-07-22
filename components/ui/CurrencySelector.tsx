// 📁 components/ui/CurrencySelector.tsx
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaGlobe, FaChevronDown, FaCheck } from 'react-icons/fa';
import { useCurrencyStore, useCurrencyInfo } from '@/stores/currencyStore';
import { SupportedCurrency, CURRENCY_INFO } from '@/lib/services/exchangeRateService';

interface CurrencySelectorProps {
  showDetectionInfo?: boolean;
  className?: string;
}

const POPULAR_CURRENCIES: SupportedCurrency[] = ['USD', 'MXN', 'COP', 'ARS', 'EUR'];
const ALL_CURRENCIES: SupportedCurrency[] = Object.keys(CURRENCY_INFO) as SupportedCurrency[];

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  showDetectionInfo = false,
  className = '',
}) => {
  const { currency, setCurrency } = useCurrencyStore();
  const { currencyInfo, detectionInfo } = useCurrencyInfo();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSelect = (selectedCurrency: SupportedCurrency) => {
    setCurrency(selectedCurrency);
    setIsOpen(false);
  };
  
  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition-colors"
      >
        <FaGlobe className="text-cyan-400" size={14} />
        <span className="text-white text-sm font-medium">
          {currencyInfo.flag} {currencyInfo.code}
        </span>
        <FaChevronDown 
          className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          size={12} 
        />
      </button>
      
      {/* Detection Info */}
      {showDetectionInfo && detectionInfo && (
        <div className="mt-1 text-xs text-gray-400">
          Auto-detected via {detectionInfo.source}
        </div>
      )}
      
      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 mt-2 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden"
            >
              {/* Popular Currencies */}
              <div className="p-2">
                <div className="text-xs text-gray-400 px-2 py-1 mb-1">Popular</div>
                <div className="grid grid-cols-2 gap-1">
                  {POPULAR_CURRENCIES.map((curr) => {
                    const info = CURRENCY_INFO[curr];
                    const isSelected = curr === currency;
                    
                    return (
                      <button
                        key={curr}
                        onClick={() => handleSelect(curr)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md text-left transition-colors ${
                          isSelected 
                            ? 'bg-cyan-600 text-white' 
                            : 'hover:bg-gray-700 text-gray-200'
                        }`}
                      >
                        <span>{info.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{curr}</div>
                          <div className="text-xs text-gray-400 truncate">{info.symbol}</div>
                        </div>
                        {isSelected && <FaCheck size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* All Currencies */}
              <div className="border-t border-gray-700 p-2 max-h-60 overflow-y-auto">
                <div className="text-xs text-gray-400 px-2 py-1 mb-1">All Currencies</div>
                {ALL_CURRENCIES
                  .filter(curr => !POPULAR_CURRENCIES.includes(curr))
                  .map((curr) => {
                    const info = CURRENCY_INFO[curr];
                    const isSelected = curr === currency;
                    
                    return (
                      <button
                        key={curr}
                        onClick={() => handleSelect(curr)}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-left transition-colors ${
                          isSelected 
                            ? 'bg-cyan-600 text-white' 
                            : 'hover:bg-gray-700 text-gray-200'
                        }`}
                      >
                        <span>{info.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{curr}</div>
                          <div className="text-xs text-gray-400 truncate">{info.name}</div>
                        </div>
                        {isSelected && <FaCheck size={12} />}
                      </button>
                    );
                  })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};