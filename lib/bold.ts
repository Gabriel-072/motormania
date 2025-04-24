// 📁 /lib/bold.ts

// 1. Define BoldConfig como una INTERFAZ y expórtala
export interface BoldConfig {
  // Parámetros principales que espera BoldCheckout
  apiKey: string;
  orderId: string;
  amount: string; // <-- Mantenido como string
  currency: 'COP' | 'USD';
  description: string;
  // Nombres que espera el CONSTRUCTOR de BoldCheckout (según los docs que encontraste)
  redirectionUrl: string;       // Renombrado de callbackUrl
  integritySignature: string;   // Renombrado de integrityKey
  // Otros parámetros opcionales
  customerData?: string;        // JSON-stringified
  renderMode?: 'embedded';
  // Callbacks opcionales para feedback en el frontend (no necesariamente pasados a Bold directamente)
  onSuccess?: () => void;
  onFailed?: (details: any) => void;
  onClose?: () => void;
  onPending?: (details: any) => void;
}

// 2. La función openBoldCheckout ACEPTA el tipo BoldConfig
export const openBoldCheckout = (cfg: BoldConfig) => {
  if (typeof window === 'undefined') {
      console.error("Bold Checkout cannot be opened server-side.");
      return;
  }
  console.log("openBoldCheckout called with config:", {
      ...cfg, // Log everything EXCEPT sensitive keys if needed
      apiKey: cfg.apiKey ? '***' : 'MISSING', // Mask API key
      integritySignature: cfg.integritySignature ? '***' : 'MISSING', // Mask signature
  });

  const scriptSrc = 'https://checkout.bold.co/library/boldPaymentButton.js';

  const launch = () => {
    console.log("Attempting to get window.BoldCheckout...");
    const BoldCheckout = (window as any).BoldCheckout;
    if (!BoldCheckout) {
      console.error('BoldCheckout object not found on window. Script might not have loaded.');
      // Podrías notificar al usuario aquí o llamar a cfg.onFailed si existe
      cfg.onFailed?.({ message: "Error al cargar la pasarela de pago." });
      return;
    }
    console.log("BoldCheckout object found. Instantiating...");

    try {
      // 3. Pasa los parámetros con los NOMBRES CORRECTOS al constructor
      const checkoutInstance = new BoldCheckout({
        apiKey: cfg.apiKey,
        orderId: cfg.orderId,
        amount: cfg.amount, // Debe ser string
        currency: cfg.currency,
        description: cfg.description,
        redirectionUrl: cfg.redirectionUrl, // <-- Nombre correcto aquí
        integritySignature: cfg.integritySignature, // <-- Nombre correcto aquí
        customerData: cfg.customerData,
        renderMode: cfg.renderMode || 'embedded',
        // NOTA: La documentación NO muestra que los callbacks (onSuccess, etc.)
        // se pasen al *constructor*. Probablemente se manejan con eventos
        // o métodos separados después de .open() o con la redirección.
        // Por ahora, los recibimos en `cfg` pero no los pasamos aquí.
      });

      // 4. Llama a open() y maneja los callbacks de UI definidos en cfg
      //    (Estos son para TU UI, no necesariamente eventos directos de Bold aquí)
      checkoutInstance.open();
      console.log("BoldCheckout instance created and open() called.");

      // --- MANEJO DE CALLBACKS (EJEMPLO - PUEDE NECESITAR AJUSTE) ---
      // Bold podría disparar eventos en window, o podrías usar la redirección.
      // Por simplicidad, llamaremos a los callbacks de cfg en puntos lógicos
      // ASUMIENDO que la redirección o eventos futuros indicarán el resultado.
      // Esto es principalmente para el feedback inmediato que configuraste.
      // El Webhook sigue siendo la fuente de verdad final.

      // Ejemplo MUY SIMPLIFICADO (esto NO detecta el pago real, solo asume éxito inicial):
      // En una implementación real, esperarías a la redirección o a eventos específicos de Bold.
     
     
      // NO podemos llamar onFailed/onPending/onClose aquí porque no sabemos si ocurrieron.
      // El código del dashboard ya los tiene configurados en la llamada a openBoldCheckout,
      // y esos SÍ se pasarán a esta función `openBoldCheckout`.
      // La librería `lib/bold.ts` DEBE decidir CÓMO y CUÁNDO llamar a esos cfg.onFailed, etc.
      // Lo más probable es que la librería JS de Bold (BoldCheckout) tenga sus propios
      // métodos o eventos para esto. Por ahora, mantenemos la estructura simple.

    } catch (initError) {
      console.error("Error initializing or opening BoldCheckout:", initError);
      // Llama a onFailed si la inicialización falla
      if (cfg.onFailed) {
        cfg.onFailed({ message: "Error inicializando Bold Checkout." });
      }
    }
  };

  // Carga de script y listener (igual que antes)
  if ((window as any).BoldCheckout) {
    console.log("BoldCheckout already loaded, launching directly.");
    launch();
  } else {
    console.log("BoldCheckout not loaded, adding event listener for boldCheckoutLoaded.");
    // Limpia listeners anteriores por si acaso
    window.removeEventListener('boldCheckoutLoaded', launch);
    window.removeEventListener('boldCheckoutLoadFailed', () => { console.error("Previously added: Bold Checkout script failed to load."); });

    window.addEventListener('boldCheckoutLoaded', launch, { once: true });
    window.addEventListener('boldCheckoutLoadFailed', () => {
        console.error("Bold Checkout script failed to load.");
        if (cfg.onFailed) {
            cfg.onFailed({ message: "No se pudo cargar la pasarela de pago." });
        }
    }, { once: true });

    // Añadir un timeout por si el script nunca carga
     setTimeout(() => {
         if (!(window as any).BoldCheckout) {
             console.error("Bold Checkout script load timed out.");
              if (cfg.onFailed) {
                 cfg.onFailed({ message: "Timeout al cargar la pasarela de pago." });
             }
         }
     }, 10000); // Timeout de 10 segundos (ajustable)

  }
}; // Fin openBoldCheckout