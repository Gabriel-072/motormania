export interface BoldConfig {
  apiKey: string;
  orderId: string;
  amount: number;
  currency: 'COP' | 'USD';
  description: string;
  callbackUrl: string;   // matches our API
  integrityKey: string;  // matches our API
  customerData?: string; // JSON-stringified
  renderMode?: 'embedded';
}

export const openBoldCheckout = (cfg: BoldConfig) => {
  if (typeof window === 'undefined') return;

  // ensure SDK is in <head> (we preload it in layout)
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
      console.error('BoldCheckout not ready');
      return;
    }
    new BoldCheckout({
      apiKey: cfg.apiKey,
      orderId: cfg.orderId,
      amount: cfg.amount,
      currency: cfg.currency,
      description: cfg.description,
      redirectionUrl: cfg.callbackUrl,       // ⚠️ Bold expects “redirectionUrl”
      integritySignature: cfg.integrityKey,  // ⚠️ Bold expects “integritySignature”
      customerData: cfg.customerData,
      renderMode: cfg.renderMode || 'embedded',
    }).open();
  };

  // if it’s already on window, go now; otherwise wait for it
  if ((window as any).BoldCheckout) {
    launch();
  } else {
    window.addEventListener('boldCheckoutLoaded', launch, { once: true });
  }
};