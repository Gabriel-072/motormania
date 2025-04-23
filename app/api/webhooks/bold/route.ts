import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- Env Vars ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const boldWebhookSecret = process.env.BOLD_SECRET_KEY!;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL!;
const EXTRA_NUMBER_COUNT = 5;

// --- Init ---
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Verify Bold Signature ---
async function verifyBoldSignature(signature: string, rawBody: string): Promise<boolean> {
  try {
    const encodedBody = Buffer.from(rawBody).toString('base64');
    console.log('Encoded body for signature:', encodedBody.substring(0, 200));
    const expectedSignature = crypto
      .createHmac('sha256', boldWebhookSecret)
      .update(encodedBody)
      .digest('hex');
    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    console.log('Signature verification:', {
      isValid,
      receivedSignature: signature,
      expectedSignature,
      boldSecretKey: boldWebhookSecret.substring(0, 4) + '...',
    });
    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// --- Generate Unique Numbers ---
async function generateUniqueNumbers(existingNumbers: string[], count: number): Promise<string[]> {
  const newNumbers: string[] = [];
  const allExisting = new Set(existingNumbers);
  while (newNumbers.length < count) {
    const num = Math.floor(100000 + Math.random() * 900000).toString();
    if (!allExisting.has(num)) {
      newNumbers.push(num);
      allExisting.add(num);
    }
  }
  return newNumbers;
}

// --- Process Sale ---
async function processApprovedSale(supabase: SupabaseClient, bodyData: any) {
  console.log('Processing SALE_APPROVED:', JSON.stringify(bodyData, null, 2));

  try {
    const { payment_id, amount, metadata } = bodyData;
    const reference = metadata?.reference;
    const totalAmount = amount?.total;

    // Validar datos de entrada
    if (!payment_id || !reference || totalAmount == null) {
      throw new Error(`Missing payment data: ${JSON.stringify({ payment_id, reference, totalAmount })}`);
    }
    if (typeof totalAmount !== 'number' || isNaN(totalAmount)) {
      throw new Error(`Invalid amount: ${totalAmount}`);
    }

    // Extraer user_id
    let userId = null;
    if (reference.includes('user_')) {
      const parts = reference.split('-');
      userId = parts.find((part: string) => part.startsWith('user_')) || null;
    }
    if (!userId) {
      const match = reference.match(/user_[a-zA-Z0-9]+/);
      userId = match ? match[0] : null;
    }
    if (!userId) throw new Error(`Invalid reference format: ${reference}`);
    console.log('Extracted userId:', userId);

    // Verificar usuario
    console.log('Checking if user exists in clerk_users:', userId);
    const { data: userExists } = await supabase
      .from('clerk_users')
      .select('clerk_id')
      .eq('clerk_id', userId)
      .maybeSingle();
    if (!userExists) throw new Error(`User not found in clerk_users: ${userId}`);

    const txDescription = `Compra de ${EXTRA_NUMBER_COUNT} números extra via Bold (Ref: ${reference}, BoldID: ${payment_id})`;

    // Evitar transacciones duplicadas
    console.log('Checking for existing transaction:', txDescription);
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('description', txDescription)
      .maybeSingle();
    if (existingTx) {
      console.warn(`Transaction already processed: ${txDescription}`);
      return;
    }

    // Insertar transacción
    console.log('Inserting transaction:', { userId, amount: totalAmount, description: txDescription });
    const { error: insertTxError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'recarga',
        amount: totalAmount,
        description: txDescription,
      });
    if (insertTxError) throw new Error(`Insert transaction failed: ${insertTxError.message}`);

    // Generar números únicos
    console.log('Fetching current entry for user:', userId);
    const { data: currentEntry } = await supabase
      .from('entries')
      .select('numbers, paid_numbers_count')
      .eq('user_id', userId)
      .maybeSingle();

    const existingNumbers = currentEntry?.numbers || [];
    console.log('Generating new numbers. Existing:', existingNumbers);
    const newNumbers = await generateUniqueNumbers(existingNumbers, EXTRA_NUMBER_COUNT);
    const updatedNumbers = [...existingNumbers, ...newNumbers];
    const updatedPaidCount = (currentEntry?.paid_numbers_count || 0) + EXTRA_NUMBER_COUNT;

    // Usar upsert para entries
    console.log('Upserting entries:', { userId, numbers: updatedNumbers, paid_numbers_count: updatedPaidCount });
    const { error: upsertError } = await supabase
      .from('entries')
      .upsert(
        {
          user_id: userId,
          numbers: updatedNumbers,
          paid_numbers_count: updatedPaidCount,
        },
        { onConflict: 'user_id' }
      );
    if (upsertError) throw new Error(`Failed to upsert entries: ${upsertError.message}`);

    // Enviar email
    console.log('Fetching user data for email:', userId);
    const { data: user } = await supabase
      .from('clerk_users')
      .select('email, full_name')
      .eq('clerk_id', userId)
      .maybeSingle();
    const to = user?.email;
    const name = user?.full_name || 'Usuario';

    if (to) {
      console.log('Sending email confirmation to:', to);
      await fetch(`${appUrl}/api/send-numbers-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Referer': appUrl,
        },
        body: JSON.stringify({
          to,
          name,
          numbers: newNumbers,
          context: 'compra',
          orderId: reference,
          amount: totalAmount,
        }),
      }).catch(err => console.error('Email confirmation failed:', err));
    } else {
      console.warn('No email found for user:', userId);
    }

    console.log('Sale processed successfully:', { payment_id, userId });
  } catch (error) {
    console.error('Error processing sale:', error);
    throw error;
  }
}

// --- POST Handler ---
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-bold-signature') || '';
    console.log('Webhook received:', { signature, rawBody: rawBody.substring(0, 200) });

    if (!await verifyBoldSignature(signature, rawBody)) {
      console.error('Invalid signature:', { signature, rawBody: rawBody.substring(0, 200) });
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log('Parsed webhook body:', JSON.stringify(body, null, 2));

    // Responde inmediatamente y procesa en segundo plano
    if (body.type === 'SALE_APPROVED') {
      processApprovedSale(supabase, body.data).catch(err => {
        console.error('Background processing error:', err);
      });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}