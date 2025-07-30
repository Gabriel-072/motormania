// components/ui/CurrencySelector.tsx - FIXED FOR YOUR STORE
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
          Auto-detected via {detectionInfo.method}
        </div>
      )}

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {/* Popular Currencies */}
            <div className="p-2 border-b border-gray-700">
              <div className="text-xs text-gray-400 px-2 py-1 font-medium">Popular</div>
              {POPULAR_CURRENCIES.map((curr) => {
                const info = CURRENCY_INFO[curr];
                return (
                  <button
                    key={curr}
                    onClick={() => handleSelect(curr)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                      currency === curr
                        ? 'bg-cyan-600 text-white'
                        : 'text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{info.flag}</span>
                      <span>{info.code}</span>
                      <span className="text-xs text-gray-400">{info.name}</span>
                    </div>
                    {currency === curr && <FaCheck size={12} />}
                  </button>
                );
              })}
            </div>

            {/* All Currencies */}
            <div className="p-2 max-h-48 overflow-y-auto">
              <div className="text-xs text-gray-400 px-2 py-1 font-medium">All Currencies</div>
              {ALL_CURRENCIES.filter(curr => !POPULAR_CURRENCIES.includes(curr)).map((curr) => {
                const info = CURRENCY_INFO[curr];
                return (
                  <button
                    key={curr}
                    onClick={() => handleSelect(curr)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                      currency === curr
                        ? 'bg-cyan-600 text-white'
                        : 'text-gray-200 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{info.flag}</span>
                      <span>{info.code}</span>
                      <span className="text-xs text-gray-400">{info.name}</span>
                    </div>
                    {currency === curr && <FaCheck size={12} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};