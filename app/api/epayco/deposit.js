import Epayco from 'epayco-sdk-node';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    amount,
    userId,
    paymentMethod,
    docType,
    docNumber,
    name,
    lastName,
    email,
    phone,
    cashOption,
    bankCode,
    token_card,
  } = req.body;

  if (!amount || !userId || !paymentMethod || !docType || !docNumber || !name || !lastName || !email || !phone) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const epayco = new Epayco({
    apiKey: process.env.EPAYCO_PUBLIC_KEY,
    privateKey: process.env.EPAYCO_PRIVATE_KEY,
    lang: 'ES',
    test: process.env.EPAYCO_TEST === 'true',
  });

  const baseData = {
    invoice: `DEP-${Date.now()}`,
    description: 'Depósito en billetera',
    value: amount.toString(),
    tax: '0',
    tax_base: amount.toString(),
    currency: 'COP',
    doc_type: docType,
    doc_number: docNumber,
    name,
    last_name: lastName,
    email,
    cell_phone: phone,
    ip: req.headers['x-forwarded-for'] || '127.0.0.1',
    url_response: `${process.env.NEXT_PUBLIC_APP_URL}/wallet`,
    url_confirmation: `${process.env.NEXT_PUBLIC_APP_URL}/api/epayco/confirm`,
    method_confirmation: 'POST',
    extras_epayco: { extra1: userId },
  };

  try {
    let response;
    switch (paymentMethod) {
      case 'card':
        if (!token_card) throw new Error('Token de tarjeta requerido');
        response = await epayco.charge.create({
          ...baseData,
          token_card,
          dues: '1',
        });
        break;
      case 'pse':
        if (!bankCode) throw new Error('Código de banco requerido');
        response = await epayco.bank.create({
          ...baseData,
          bank: bankCode,
          type_person: '0',
        });
        break;
      case 'cash':
        if (!cashOption) throw new Error('Opción de efectivo requerida');
        response = await epayco.cash.create(cashOption, {
          ...baseData,
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        break;
      default:
        throw new Error('Método de pago no soportado');
    }

    console.log('ePayco response:', response); // Debug log
    if (!response.success || (!response.data?.urlbanco && !response.data?.url && !response.data?.ref_payco)) {
      return res.status(400).json({ error: response.text || 'Error iniciando el pago' });
    }

    res.status(200).json({
      redirectUrl: response.data?.urlbanco || response.data?.url || `${process.env.NEXT_PUBLIC_APP_URL}/wallet`,
      refPayco: response.data?.ref_payco,
    });
  } catch (error) {
    console.error('ePayco deposit error:', error);
    res.status(500).json({ error: error.message || 'Error procesando el pago' });
  }
}