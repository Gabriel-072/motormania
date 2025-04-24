// verificarFirmaBold.js
import crypto from 'crypto';

// Datos de la transacción (ajusta estos valores si estás probando con otro monto/orderId)
const userId = 'user_2w9PL6pxys1S78g9sHJ9hIMDVIm';
const timestamp = '1745456105950';
const amount = 2000; // sin decimales
const currency = 'COP';

// Llave secreta de Bold
const secretKey = 'ij9LPCRa3vTaICznfrn3J3w'; // ← NO subas esto a producción o a un repo público

// ⚙️ Construcción de orderId, amountStr y dataToSign
const orderId = `ORDER-${userId}-${timestamp}`;
const amountStr = amount.toFixed(2); // Siempre con dos decimales
const dataToSign = `${orderId}${amountStr}${currency}`;

// 🔐 Crear firma
const integritySignature = crypto
  .createHmac('sha256', secretKey)
  .update(dataToSign)
  .digest('hex');

// 🧾 Mostrar resultados
console.log('✅ Order ID:', orderId);
console.log('✅ AmountStr:', amountStr);
console.log('✅ Data to sign:', dataToSign);
console.log('🔐 Signature generada:', integritySignature);