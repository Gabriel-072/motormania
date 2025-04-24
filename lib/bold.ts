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
  const existing = document.querySelector(`script[src="${scriptSrc}"]`);

  const launch = () => {
    const BoldCheckout = (window as any).BoldCheckout;
    if (!BoldCheckout) return console.error('BoldCheckout no disponible');

    const checkout = new BoldCheckout({
      apiKey: config.apiKey,
      orderId: config.orderId,
      amount: config.amount,       // <-- entero
      currency: config.currency,
      description: config.description,
      redirectionUrl: config.redirectionUrl,
      integritySignature: config.integritySignature,
      customerData: config.customerData,
      renderMode: 'embedded',
    });
    checkout.open();
  };

  if (!existing) {
    const s = document.createElement('script');
    s.src = scriptSrc;
    s.async = true;
    s.onload = launch;
    document.head.appendChild(s);
  } else {
    launch();
  }
};