// 📁 stores/currencyStore.ts
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
  // Current state
  currency: SupportedCurrency;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Detection info
  detectionInfo: LocationInfo | null;
  ratesInfo: { lastUpdated: string; source: string } | null;
  
  // Actions
  setCurrency: (currency: SupportedCurrency) => void;
  initializeCurrency: () => Promise<void>;
  refreshRates: () => Promise<void>;
  
  // Conversion utilities
  convertFromCOP: (copAmount: number) => number;
  convertToCOP: (amount: number) => number;
  formatAmount: (copAmount: number, options?: { showCode?: boolean; showFlag?: boolean }) => string;
  
  // UI helpers
  getCurrencyInfo: () => typeof CURRENCY_INFO[SupportedCurrency];
  getMinimumBet: () => { cop: number; display: number; formatted: string };
}

const STORAGE_KEY = 'mmc-currency-preference';
const USER_OVERRIDE_KEY = 'user-currency-override';

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      // Initial state
      currency: 'USD',
      isLoading: false,
      isInitialized: false,
      detectionInfo: null,
      ratesInfo: null,

      // Set currency (user choice)
      setCurrency: (currency: SupportedCurrency) => {
        console.log(`💱 User selected currency: ${currency}`);
        
        // Mark as user override
        if (typeof window !== 'undefined') {
          localStorage.setItem(USER_OVERRIDE_KEY, 'true');
        }
        
        set({ currency });
      },

      // Initialize currency with auto-detection
      initializeCurrency: async () => {
        if (get().isInitialized) return;
        
        set({ isLoading: true });
        
        try {
          console.log('🚀 Initializing currency system...');
          
          // Check if user has manually selected a currency before
          const hasUserOverride = typeof window !== 'undefined' 
            ? localStorage.getItem(USER_OVERRIDE_KEY) === 'true'
            : false;
          
          if (hasUserOverride) {
            console.log('👤 User has currency preference, skipping auto-detection');
          } else {
            // Auto-detect currency
            console.log('🔍 Auto-detecting user currency...');
            
            // Quick detection first (no IP lookup)
            const quickDetection = locationDetectionService.detectUserCurrencyQuick();
            
            set({ 
              currency: quickDetection.currency,
              detectionInfo: quickDetection 
            });
            
            console.log(`⚡ Quick detection result: ${quickDetection.currency} (${quickDetection.source}, ${quickDetection.confidence})`);
            
            // If confidence is low, try more accurate detection in background
            if (quickDetection.confidence === 'low') {
              locationDetectionService.detectUserCurrency().then(fullDetection => {
                if (fullDetection.confidence !== 'low' && !get().isLoading) {
                  console.log(`🎯 Improved detection: ${fullDetection.currency} (${fullDetection.source})`);
                  set({ 
                    currency: fullDetection.currency,
                    detectionInfo: fullDetection 
                  });
                }
              }).catch(error => {
                console.warn('Background currency detection failed:', error);
              });
            }
          }
          
          // Initialize exchange rates
          console.log('💹 Loading exchange rates...');
          await exchangeRateService.getCurrentRates();
          
          const ratesInfo = exchangeRateService.getRatesInfo();
          set({ 
            ratesInfo,
            isInitialized: true,
            isLoading: false 
          });
          
          console.log('✅ Currency system initialized successfully');
          
        } catch (error) {
          console.error('❌ Currency initialization failed:', error);
          
          // Fallback to USD with basic rates
          set({ 
            currency: 'USD',
            isInitialized: true,
            isLoading: false,
            detectionInfo: {
              currency: 'USD',
              country: null,
              timezone: null,
              locale: null,
              confidence: 'low',
              source: 'fallback'
            }
          });
        }
      },

      // Refresh exchange rates
      refreshRates: async () => {
        try {
          console.log('🔄 Refreshing exchange rates...');
          await exchangeRateService.refreshRates();
          
          const ratesInfo = exchangeRateService.getRatesInfo();
          set({ ratesInfo });
          
          console.log('✅ Exchange rates refreshed');
        } catch (error) {
          console.error('❌ Failed to refresh rates:', error);
        }
      },

      // Convert COP to display currency
      convertFromCOP: (copAmount: number) => {
        const { currency } = get();
        return exchangeRateService.convertFromCOP(copAmount, currency);
      },

      // Convert display currency back to COP
      convertToCOP: (amount: number) => {
        const { currency } = get();
        return exchangeRateService.convertToCOP(amount, currency);
      },

      // Format amount in display currency
      formatAmount: (copAmount: number, options = {}) => {
        const { currency } = get();
        const convertedAmount = exchangeRateService.convertFromCOP(copAmount, currency);
        return formatCurrency(convertedAmount, currency, options);
      },

      // Get currency info
      getCurrencyInfo: () => {
        const { currency } = get();
        return CURRENCY_INFO[currency];
      },

      // Get minimum bet in display currency
      getMinimumBet: () => {
        const { currency } = get();
        const copAmount = 10000; // Minimum bet in COP
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
      // Only persist currency selection, not loading states
      partialize: (state) => ({ 
        currency: state.currency,
        isInitialized: state.isInitialized 
      }),
    }
  )
);

// Utility hooks for common operations
export const useCurrencyConverter = () => {
  const { convertFromCOP, convertToCOP, formatAmount } = useCurrencyStore();
  
  return {
    convertFromCOP,
    convertToCOP,
    formatAmount,
    
    // Quick format for common use cases
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