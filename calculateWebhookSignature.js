const crypto = require('crypto');

const rawBody = JSON.stringify({
  id: '191850cb-00f8-4f64-aa5f-4975848e9428',
  type: 'SALE_APPROVED',
  subject: 'CP332C3C9WZU',
  source: '/payments',
  spec_version: '1.0',
  time: 1711989345347444700,
  data: {
    payment_id: 'CP332C3C9WZU',
    merchant_id: 'CKKA859CGE',
    created_at: '2024-04-01T11:35:42-05:00',
    amount: { total: 2000, taxes: [], tip: 0 },
    payment_method: 'CARD',
    metadata: { reference: 'ORDER-user_ABCDE-1234-test' }
  },
  datacontenttype: 'application/json'
});

const encoded = Buffer.from(rawBody).toString('base64');
const secretKey = 'Tleqx9F6wg1ZQgaapnveIw'; // Tu BOLD_SECRET_KEY
const hashed = crypto.createHmac('sha256', secretKey).update(encoded).digest('hex');
console.log('Signature:', hashed);