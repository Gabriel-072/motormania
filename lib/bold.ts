// ──────────────────────────────────────────────────────────────────────────────
// MODULE: bold.ts — Utilidad para iniciar pagos con Bold desde el frontend
// ──────────────────────────────────────────────────────────────────────────────

export interface BoldConfig {
    apiKey: string;
    orderId: string;
    amount: number;
    currency: 'COP' | 'USD';
    description: string;
    redirectionUrl: string;
    integritySignature: string;
    customerData?: {
      email?: string;
      fullName?: string;
      phone?: string;
      documentNumber?: string;
      documentType?: string;
    };
  }
  
  export const openBoldCheckout = (config: BoldConfig) => {
    if (typeof window === 'undefined') return;
  
    const scriptSrc = 'https://checkout.bold.co/library/boldPaymentButton.js';
    const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
  
    const launch = () => {
      if (!(window as any).BoldCheckout) {
        console.error('BoldCheckout is not available');
        return;
      }
  
      const BoldCheckout = (window as any).BoldCheckout;
      const checkout = new BoldCheckout({
        apiKey: config.apiKey,
        orderId: config.orderId,
        amount: config.amount.toString(),
        currency: config.currency,
        description: config.description,
        redirectionUrl: config.redirectionUrl,
        integritySignature: config.integritySignature,
        customerData: JSON.stringify(config.customerData || {}),
        renderMode: 'embedded',
      });
  
      checkout.open();
    };
  
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.onload = () => {
        window.dispatchEvent(new Event('boldCheckoutLoaded'));
        launch();
      };
      script.onerror = () => {
        window.dispatchEvent(new Event('boldCheckoutLoadFailed'));
      };
      document.head.appendChild(script);
    } else {
      launch();
    }
  };
  