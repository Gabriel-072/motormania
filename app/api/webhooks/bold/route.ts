// 📁 /app/api/webhooks/bold/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- Environment Variables Checks ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const boldWebhookSecret = process.env.BOLD_WEBHOOK_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || ''; // For calling internal API

if (!supabaseUrl || !supabaseServiceKey || !boldWebhookSecret) {
  console.error("FATAL: Missing required environment variables for Bold Webhook handler.");
}

// --- Initialize Supabase Admin Client ---
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// --- Constants ---
const EXTRA_NUMBER_COUNT = 5;
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';

// --- Helper Function: Verify Bold Signature ---
async function verifyBoldSignature(signature: string, rawBody: string): Promise<boolean> {
  if (!boldWebhookSecret) {
    console.error("BOLD_WEBHOOK_SECRET_KEY is not configured.");
    return false;
  }
  try {
    const encodedBody = Buffer.from(rawBody).toString('base64');
    const expectedSignature = crypto
      .createHmac('sha256', boldWebhookSecret)
      .update(encodedBody)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) {
    console.error("Error during signature verification:", error);
    return false;
  }
}

// --- Helper Function: Process Approved Sale ---
async function processApprovedSale(supabase: SupabaseClient, bodyData: any) {
  const { payment_id, amount, metadata } = bodyData;
  const reference = metadata?.reference; // Expecting "MM-EXTRA-${userId}-${timestamp}"
  const totalAmount = amount?.total;

  if (!payment_id || !reference || totalAmount === undefined || totalAmount === null) {
    throw new Error(`Webhook payload missing essential data for reference: ${reference || 'UNKNOWN'}`);
  }

  // 1. Extract User ID
  let userId: string | null = null;
  try {
    const parts = reference.split('-');
    if (parts.length === 4 && parts[0] === 'MM' && parts[1] === 'EXTRA' && parts[2].startsWith('user_')) {
      userId = parts[2]; // Clerk User ID
    } else { throw new Error(`Unexpected reference format`); }
  } catch (parseError) {
    throw new Error(`Could not parse user_id from reference "${reference}". Error: ${parseError instanceof Error ? parseError.message : parseError}`);
  }
  if (!userId) { throw new Error(`Failed to extract valid user_id from reference "${reference}".`); }
  console.log(`Processing SALE_APPROVED: UserID=${userId}, PaymentID=${payment_id}, Ref=${reference}`);

  // 2. Idempotency Check & Transaction Logging
  const transactionDescription = `Compra de ${EXTRA_NUMBER_COUNT} números extra via Bold (Ref: ${reference}, BoldID: ${payment_id})`;
  const { data: existingTx, error: txCheckError } = await supabase
    .from('transactions').select('id').eq('description', transactionDescription).limit(1).maybeSingle();
  if (txCheckError) { throw new Error(`DB Error (Idempotency Check): ${txCheckError.message}`); }
  if (existingTx) { console.log(`Webhook Info (PaymentID: ${payment_id}): Event already processed.`); return; }

  const { error: insertTxError } = await supabase.from('transactions').insert({
    user_id: userId, type: 'recarga', amount: totalAmount, description: transactionDescription,
  });
  if (insertTxError) { throw new Error(`DB Error (Insert Transaction): ${insertTxError.message}`); }
  console.log(`Transaction logged for PaymentID: ${payment_id}`);

  // 3. Assign Numbers (Update 'entries')
  const newNumbers = Array.from({ length: EXTRA_NUMBER_COUNT }, () => Math.floor(100000 + Math.random() * 900000).toString());
  const { data: currentEntry, error: fetchEntryError } = await supabase
    .from('entries').select('numbers, paid_numbers_count').eq('user_id', userId).limit(1).maybeSingle();
  if (fetchEntryError) { throw new Error(`DB Error (Fetch Entry): ${fetchEntryError.message}`); }
  if (!currentEntry) {
    console.error(`Webhook Critical Error (PaymentID: ${payment_id}): User ${userId} paid but has no row in 'entries'!`);
    throw new Error(`User ${userId} has no entry row to update.`);
  }
  const existingNumbers = (currentEntry.numbers || []).map(String);
  const updatedNumbers = [...existingNumbers, ...newNumbers];
  const updatedPaidCount = (currentEntry.paid_numbers_count || 0) + EXTRA_NUMBER_COUNT;
  const { error: updateEntryError } = await supabase.from('entries').update({
    numbers: updatedNumbers, paid_numbers_count: updatedPaidCount
  }).eq('user_id', userId);
  if (updateEntryError) { throw new Error(`DB Error (Update Entry): ${updateEntryError.message}`); }
  console.log(`Entries updated for UserID: ${userId}, PaymentID: ${payment_id}`);

  // 4. Fetch User's Email
  const { data: userData, error: fetchUserError } = await supabase
    .from('clerk_users').select('email, full_name').eq('clerk_id', userId).limit(1).maybeSingle(); // Fetch name too if available
  if (fetchUserError) { console.error(`Webhook Warning (PaymentID: ${payment_id}): Could not fetch email/name for user ${userId}. Error: ${fetchUserError?.message}`); }

  const userEmail = userData?.email;
  const userName = userData?.full_name || 'Usuario'; // Use fetched name or fallback

  // 5. Trigger Centralized Email Confirmation API (Fire-and-forget)
  if (userEmail) {
    fetch(`${appUrl}/api/send-numbers-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${INTERNAL_API_SECRET}` },
      body: JSON.stringify({
        to: userEmail, name: userName, numbers: newNumbers, context: 'compra', orderId: reference, amount: totalAmount
      }),
    }).catch(emailError => console.error(`Non-blocking: Email confirmation error for PaymentID ${payment_id}:`, emailError));
    console.log(`Email confirmation initiated via API for ${userEmail}, PaymentID: ${payment_id}`);
  } else {
    console.warn(`Skipping email confirmation for PaymentID ${payment_id}: User email not found.`);
  }
  console.log(`✅ Webhook processing complete for PaymentID: ${payment_id}`);
}


// --- Main POST Handler ---
export async function POST(req: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await req.text();
    const signature = req.headers.get('x-bold-signature') || '';
    const isValid = await verifyBoldSignature(signature, rawBody);
    if (!isValid) { return new NextResponse('Invalid signature', { status: 401 }); }

    const body = JSON.parse(rawBody);

    if (body.type === 'SALE_APPROVED') {
      try {
        await processApprovedSale(supabase, body.data);
        return new NextResponse('OK', { status: 200 }); // OK after processing attempt
      } catch (processingError) {
        console.error(`❌ Webhook SALE_APPROVED Processing Error:`, processingError instanceof Error ? processingError.message : processingError);
        return new NextResponse('OK (Processing Error Logged)', { status: 200 }); // Still OK to Bold
      }
    } else if (body.type === 'SALE_REJECTED') {
      const { payment_id, metadata } = body.data;
      console.log(`Received SALE_REJECTED: PaymentID=${payment_id}, Ref=${metadata?.reference}`);
      // Optional: Log rejected transaction to your DB if needed
      return new NextResponse('OK (Rejected)', { status: 200 });
    } else {
      console.log(`Received unhandled webhook event type: ${body.type}`);
      return new NextResponse('OK (Unhandled Type)', { status: 200 });
    }
  } catch (error) {
    console.error('❌ Top-level Webhook error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}