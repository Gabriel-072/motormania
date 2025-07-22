// 📁 components/ui/CurrencyStatusIndicator.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FaWifi, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { useCurrencyStore, useCurrencyInfo } from '@/stores/currencyStore';

export const CurrencyStatusIndicator: React.FC = () => {
  const { isLoading, refreshRates } = useCurrencyStore();
  const { ratesInfo, detectionInfo } = useCurrencyInfo();
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <FaSpinner className="animate-spin" />
        <span>Loading rates...</span>
      </div>
    );
  }
  
  if (!ratesInfo) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400">
        <FaExclamationTriangle />
        <span>Rates unavailable</span>
      </div>
    );
  }
  
  const isLive = ratesInfo.source === 'api';
  const lastUpdated = new Date(ratesInfo.lastUpdated);
  const hoursAgo = Math.round((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60));
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-xs"
    >
      {isLive ? (
        <FaWifi className="text-green-400" />
      ) : (
        <FaExclamationTriangle className="text-yellow-400" />
      )}
      
      <span className={isLive ? 'text-green-400' : 'text-yellow-400'}>
        {isLive ? 'Live rates' : 'Fallback rates'}
      </span>
      
      {hoursAgo > 0 && (
        <span className="text-gray-500">
          • {hoursAgo}h ago
        </span>
      )}
      
      {detectionInfo && (
        <span className="text-gray-500">
          • Auto-detected
        </span>
      )}
      
      <button
        onClick={() => refreshRates()}
        className="text-cyan-400 hover:text-cyan-300 underline"
      >
        Refresh
      </button>
    </motion.div>
  );
};