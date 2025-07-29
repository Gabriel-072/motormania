// 📁 stores/currencyStore.ts - FIXED INITIALIZATION
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  SupportedCurrency, 
  exchangeRateService, 
  formatCurrency,
  CURRENCY_INFO 
} from '@/lib/services/exchangeRateService';
import { 
  locationDetectionService, 
  LocationInfo 
} from '@/lib/services/locationDetectionService';

interface CurrencyState {
  currency: SupportedCurrency;
  isLoading: boolean;
  isInitialized: boolean;
  detectionInfo: LocationInfo | null;
  ratesInfo: { lastUpdated: string; source: string } | null;
  
  setCurrency: (currency: SupportedCurrency) => void;
  initializeCurrency: () => Promise<void>;
  refreshRates: () => Promise<void>;
  convertFromCOP: (copAmount: number) => number;
  convertToCOP: (amount: number) => number;
  formatAmount: (copAmount: number, options?: { showCode?: boolean; showFlag?: boolean }) => string;
  getCurrencyInfo: () => typeof CURRENCY_INFO[SupportedCurrency];
  getMinimumBet: () => { cop: number; display: number; formatted: string };
}

const STORAGE_KEY = 'mmc-currency-preference';
const USER_OVERRIDE_KEY = 'user-currency-override';

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      currency: 'USD',
      isLoading: false,
      isInitialized: false,
      detectionInfo: null,
      ratesInfo: null,

      setCurrency: (currency: SupportedCurrency) => {
        console.log(`💱 User selected currency: ${currency}`);
        if (typeof window !== 'undefined') {
          localStorage.setItem(USER_OVERRIDE_KEY, 'true');
        }
        set({ currency });
      },

      initializeCurrency: async () => {
        const current = get();
        if (current.isInitialized) {
          console.log('✅ Currency already initialized:', current.currency);
          return;
        }
        
        console.log('🚀 Initializing currency system...');
        set({ isLoading: true });
        
        try {
          const hasUserOverride = typeof window !== 'undefined' 
            ? localStorage.getItem(USER_OVERRIDE_KEY) === 'true'
            : false;
          
          let finalCurrency: SupportedCurrency;
          let detectionInfo: LocationInfo;
          
          if (hasUserOverride) {
            console.log('👤 Using user preference');
            finalCurrency = current.currency;
            detectionInfo = {
              currency: finalCurrency,
              country: null,
              timezone: null,
              locale: null,
              confidence: 'high',
              source: 'ip'
            };
          } else {
            console.log('🔍 Auto-detecting currency...');
            
            // Force fresh detection - don't rely on quick detection
            detectionInfo = await locationDetectionService.detectUserCurrency();
            finalCurrency = detectionInfo.currency;
            
            console.log(`🎯 Detected: ${finalCurrency} (${detectionInfo.source}, ${detectionInfo.confidence})`);
          }
          
          // Initialize exchange rates
          console.log('💹 Loading exchange rates...');
          await exchangeRateService.getCurrentRates();
          const ratesInfo = exchangeRateService.getRatesInfo();
          
          set({ 
            currency: finalCurrency,
            detectionInfo,
            ratesInfo,
            isInitialized: true,
            isLoading: false 
          });
          
          console.log(`✅ Currency system ready: ${finalCurrency}`);
          
        } catch (error) {
          console.error('❌ Currency initialization failed:', error);
          
          // Fallback to manual detection without IP
          const fallbackDetection = locationDetectionService.detectUserCurrencyQuick();
          
          set({ 
            currency: fallbackDetection.currency,
            detectionInfo: fallbackDetection,
            isInitialized: true,
            isLoading: false,
            ratesInfo: null
          });
          
          console.log(`🆘 Fallback currency: ${fallbackDetection.currency}`);
        }
      },

      refreshRates: async () => {
        try {
          console.log('🔄 Refreshing exchange rates...');
          await exchangeRateService.refreshRates();
          const ratesInfo = exchangeRateService.getRatesInfo();
          set({ ratesInfo });
        } catch (error) {
          console.error('❌ Failed to refresh rates:', error);
        }
      },

      convertFromCOP: (copAmount: number) => {
        const { currency } = get();
        return exchangeRateService.convertFromCOP(copAmount, currency);
      },

      convertToCOP: (amount: number) => {
        const { currency } = get();
        return exchangeRateService.convertToCOP(amount, currency);
      },

      formatAmount: (copAmount: number, options = {}) => {
        const { currency } = get();
        const convertedAmount = exchangeRateService.convertFromCOP(copAmount, currency);
        return formatCurrency(convertedAmount, currency, options);
      },

      getCurrencyInfo: () => {
        const { currency } = get();
        return CURRENCY_INFO[currency];
      },

      getMinimumBet: () => {
        const { currency } = get();
        const copAmount = 10000;
        const displayAmount = exchangeRateService.convertFromCOP(copAmount, currency);
        const formatted = formatCurrency(displayAmount, currency);
        
        return {
          cop: copAmount,
          display: displayAmount,
          formatted
        };
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ 
        currency: state.currency,
        isInitialized: state.isInitialized 
      }),
    }
  )
);

export const useCurrencyConverter = () => {
  const { convertFromCOP, convertToCOP, formatAmount } = useCurrencyStore();
  
  return {
    convertFromCOP,
    convertToCOP,
    formatAmount,
    formatCOP: (copAmount: number) => formatAmount(copAmount),
    formatCOPWithCode: (copAmount: number) => formatAmount(copAmount, { showCode: true }),
    formatCOPWithFlag: (copAmount: number) => formatAmount(copAmount, { showFlag: true }),
  };
};

export const useCurrencyInfo = () => {
  const { currency, getCurrencyInfo, getMinimumBet, detectionInfo, ratesInfo } = useCurrencyStore();
  
  return {
    currency,
    currencyInfo: getCurrencyInfo(),
    minimumBet: getMinimumBet(),
    detectionInfo,
    ratesInfo,
  };
};