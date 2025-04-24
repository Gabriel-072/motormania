// 📁 /lib/bold.ts
export interface BoldConfig {
  apiKey: string;
  referenceId: string;         // <-- orderId
  amount: number;              // integer, e.g. 2000
  currency: 'COP' | 'USD';
  description?: string;
  callbackUrl: string;         // <-- redirectionUrl
  integrityKey: string;        // <-- integritySignature
  customerData?: string;       // JSON.stringify({ … })
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

    const checkout = new BoldCheckout({
      apiKey: config.apiKey,
      referenceId: config.referenceId,
      amount: config.amount,
      currency: config.currency,
      description: config.description,
      callbackUrl: config.callbackUrl,
      integrityKey: config.integrityKey,
      customerData: config.customerData,
      integrationType: 'LIBRARY',
      renderMode: config.renderMode ?? 'embedded',
    });

    checkout.open();
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