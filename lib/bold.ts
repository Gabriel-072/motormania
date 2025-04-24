// 📁 /lib/bold.ts
export interface BoldConfig {
  apiKey: string;
  orderId: string;           // <-- keep this name
  amount: number;            // integer (e.g. 2000)
  currency: 'COP' | 'USD';
  description?: string;
  callbackUrl: string;       // <-- this will become data-callback-url
  integrityKey: string;      // <-- this will become data-integrity-key
  customerData?: string;     // JSON.stringify(...)
  renderMode?: 'embedded' | 'redirect';
}

export const openBoldCheckout = (config: BoldConfig) => {
  if (typeof window === 'undefined') return;

  const scriptSrc = 'https://checkout.bold.co/library/boldPaymentButton.js';
  const existing = document.querySelector(`script[src="${scriptSrc}"]`);

  const launch = () => {
    const BoldCheckout = (window as any).BoldCheckout;
    if (!BoldCheckout) {
      console.error('❌ BoldCheckout no disponible');
      return;
    }

    new BoldCheckout({
      apiKey: config.apiKey,
      orderId: config.orderId,
      amount: config.amount,
      currency: config.currency,
      description: config.description,
      callbackUrl: config.callbackUrl,
      integrityKey: config.integrityKey,
      customerData: config.customerData,
      integrationType: 'LIBRARY',
      renderMode: config.renderMode ?? 'embedded',
    }).open();
  };

  if (!existing) {
    const s = document.createElement('script');
    s.src = scriptSrc;
    s.async = true;
    s.onload = launch;
    s.onerror = () => console.error('❌ Error cargando Bold Checkout');
    document.head.appendChild(s);
  } else {
    launch();
  }
};