// 📁 /lib/bold.ts
export interface BoldConfig {
  apiKey: string;
  orderId: string;
  amount: number;
  currency: 'COP' | 'USD';
  description: string;
  callbackUrl: string;     // what your API gives you
  integrityKey: string;    // what your API gives you
  customerData?: string;   // JSON-stringified
  renderMode?: 'embedded';
}

export const openBoldCheckout = (config: BoldConfig) => {
  if (typeof window === 'undefined') return;

  // ensure the SDK is loaded once
  const scriptSrc = 'https://checkout.bold.co/library/boldPaymentButton.js';
  if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
    const s = document.createElement('script');
    s.src = scriptSrc;
    s.async = true;
    document.head.appendChild(s);
  }

  const launch = () => {
    const BoldCheckout = (window as any).BoldCheckout;
    if (!BoldCheckout) {
      return console.error('BoldCheckout SDK not ready');
    }

    // **map** your API field names to what Bold wants
    new BoldCheckout({
      apiKey: config.apiKey,
      orderId: config.orderId,
      amount: config.amount,
      currency: config.currency,
      description: config.description,
      redirectionUrl: config.callbackUrl,        // ← renamed here
      integritySignature: config.integrityKey,   // ← renamed here
      customerData: config.customerData,
      renderMode: config.renderMode || 'embedded',
    }).open();
  };

  // if SDK already loaded, fire immediately
  if ((window as any).BoldCheckout) {
    launch();
  } else {
    // otherwise wait until <Script> from layout has loaded it
    window.addEventListener('boldCheckoutLoaded', launch, { once: true });
  }
};