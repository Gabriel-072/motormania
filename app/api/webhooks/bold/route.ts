// 📁 /app/api/webhooks/bold/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- Environment Variables Checks ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const boldWebhookSecret = process.env.BOLD_WEBHOOK_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_SITE_URL;
// REMOVED: const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || '';

if (!supabaseUrl || !supabaseServiceKey || !boldWebhookSecret) { console.error("FATAL ERROR: Missing required env vars for Bold Webhook."); }
if (!appUrl) { console.error("FATAL ERROR: NEXT_PUBLIC_SITE_URL env var is not set."); }
// REMOVED: if (!INTERNAL_API_SECRET) { console.warn("WARN: INTERNAL_API_SECRET not set."); }

// --- Initialize Supabase Admin Client ---
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

// --- Constants ---
const EXTRA_NUMBER_COUNT = 5;
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';

// --- Helper Function: Verify Bold Signature ---
async function verifyBoldSignature(signature: string, rawBody: string): Promise<boolean> {
  if (!boldWebhookSecret) { console.error("BOLD_WEBHOOK_SECRET_KEY not set."); return false; }
  try {
    const encodedBody = Buffer.from(rawBody).toString('base64');
    const expectedSignature = crypto.createHmac('sha256', boldWebhookSecret).update(encodedBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch (error) { console.error("Bold Signature verification error:", error); return false; }
}

// --- Helper Function: Process Approved Sale ---
async function processApprovedSale(supabase: SupabaseClient, bodyData: any) {
  const { payment_id, amount, metadata } = bodyData;
  const reference = metadata?.reference;
  const totalAmount = amount?.total; // Confirmed 2000 = 2000 COP

  if (!payment_id || !reference || totalAmount === undefined || totalAmount === null) {
    throw new Error(`Bold Webhook Error: Payload missing essential data. Ref: ${reference || 'UNKNOWN'}`);
  }

  // 1. Extract User ID
  let userId: string | null = null;
  try {
    const parts = reference.split('-');
    if (parts.length === 4 && parts[0] === 'MM' && parts[1] === 'EXTRA' && parts[2].startsWith('user_')) {
      userId = parts[2];
    } else { throw new Error(`Unexpected reference format`); }
  } catch (parseError) {
    throw new Error(`Could not parse user_id from reference "${reference}". Error: ${parseError instanceof Error ? parseError.message : parseError}`);
  }
  if (!userId) { throw new Error(`Failed to extract valid user_id from reference "${reference}".`); }
  console.log(`Bold Webhook: Processing SALE_APPROVED: UserID=${userId}, PaymentID=${payment_id}, Ref=${reference}`);

  // 2. Idempotency Check & Transaction Logging
  const transactionDescription = `Compra de ${EXTRA_NUMBER_COUNT} números extra via Bold (Ref: ${reference}, BoldID: ${payment_id})`;
  console.log(`Bold Webhook: Checking idempotency for: ${transactionDescription}`);
  const { data: existingTx, error: txCheckError } = await supabase.from('transactions').select('id').eq('description', transactionDescription).limit(1).maybeSingle();
  if (txCheckError) { throw new Error(`DB Error (Idempotency Check): ${txCheckError.message}`); }
  if (existingTx) { console.log(`Bold Webhook Info (PaymentID: ${payment_id}): Event already processed.`); return; }

  console.log(`Bold Webhook: Inserting into transactions for PaymentID: ${payment_id}...`);
  const { error: insertTxError } = await supabase.from('transactions').insert({ user_id: userId, type: 'recarga', amount: totalAmount, description: transactionDescription });
  if (insertTxError?.code === '23503') { console.error(`Bold Webhook DB Error (Insert Tx ${payment_id}): User ID ${userId} FK violation.`); throw new Error(`User ${userId} not found.`); }
  else if (insertTxError) { throw new Error(`DB Error (Insert Tx): ${insertTxError.message}`); }
  console.log(`Bold Webhook: Transaction logged for PaymentID: ${payment_id}`);

  // 3. Assign Numbers (Update 'entries')
  const newNumbers = Array.from({ length: EXTRA_NUMBER_COUNT }, () => Math.floor(100000 + Math.random() * 900000).toString());
  console.log(`Bold Webhook: Fetching entries for ${userId}...`);
  const { data: currentEntry, error: fetchEntryError } = await supabase.from('entries').select('numbers, paid_numbers_count').eq('user_id', userId).limit(1).maybeSingle();
  if (fetchEntryError) { throw new Error(`DB Error (Fetch Entry): ${fetchEntryError.message}`); }
  if (!currentEntry) { console.error(`Bold Critical Error (PaymentID: ${payment_id}): User ${userId} paid but has no row in 'entries'!`); throw new Error(`User ${userId} no entry row.`); }
  const existingNumbers = (currentEntry.numbers || []).map(String);
  const updatedNumbers = [...existingNumbers, ...newNumbers];
  const updatedPaidCount = (currentEntry.paid_numbers_count || 0) + EXTRA_NUMBER_COUNT;
  console.log(`Bold Webhook: Updating entries for ${userId}...`);
  const { error: updateEntryError } = await supabase.from('entries').update({ numbers: updatedNumbers, paid_numbers_count: updatedPaidCount }).eq('user_id', userId);
  if (updateEntryError) { throw new Error(`DB Error (Update Entry): ${updateEntryError.message}`); }
  console.log(`Bold Webhook: Entries updated for UserID: ${userId}`);

  // 4. Fetch User's Email & Name
  console.log(`Bold Webhook: Fetching email/name for ${userId}...`);
  const { data: userData, error: fetchUserError } = await supabase.from('clerk_users').select('email, full_name').eq('clerk_id', userId).limit(1).maybeSingle();
  if (fetchUserError) { console.error(`Bold Warning (PaymentID: ${payment_id}): Could not fetch user data for ${userId}. Error: ${fetchUserError?.message}`); }
  const userEmail = userData?.email;
  const userName = userData?.full_name || 'Usuario';

  // 5. Trigger Centralized Email Confirmation API (WITHOUT internal secret)
  if (userEmail) {
    console.log(`Bold Webhook: Triggering email confirmation API for ${userEmail}...`);
    fetch(`${appUrl}/api/send-numbers-confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // REMOVED Authorization header
      body: JSON.stringify({ to: userEmail, name: userName, numbers: newNumbers, context: 'compra', orderId: reference, amount: totalAmount }),
    }).catch(emailError => console.error(`Non-blocking: Email API trigger failed for PaymentID ${payment_id}:`, emailError));
  } else {
    console.warn(`Bold Webhook: Skipping email confirmation for PaymentID ${payment_id}: User email not found.`);
  }
  console.log(`✅ Bold Webhook: Successfully processed SALE_APPROVED for PaymentID: ${payment_id}`);
}

// --- Main POST Handler ---
export async function POST(req: NextRequest) {
   console.log("Bold Webhook: Request received.");
  let rawBody: string;
  try {
    rawBody = await req.text();
    const signature = req.headers.get('x-bold-signature') || '';
    console.log("Bold Webhook: Verifying signature...");
    const isValid = await verifyBoldSignature(signature, rawBody);
    if (!isValid) { console.warn("⚠️ Invalid Bold webhook signature."); return new NextResponse('Invalid signature', { status: 401 }); }
    console.log("Bold Webhook: Signature verified successfully.");

    const body = JSON.parse(rawBody);
    const eventType = body.type;
    console.log(`Bold Webhook: Processing event type: ${eventType}`);

    if (eventType === 'SALE_APPROVED') {
      try {
        await processApprovedSale(supabase, body.data);
        return new NextResponse('OK', { status: 200 });
      } catch (processingError) {
        console.error(`❌ Bold Webhook SALE_APPROVED Processing Error:`, processingError instanceof Error ? processingError.message : processingError);
        return new NextResponse('OK (Processing Error Logged)', { status: 200 }); // Still OK to Bold
      }
    } else if (eventType === 'SALE_REJECTED') {
      const { payment_id, metadata } = body.data || {};
      console.log(`Bold Webhook: Received SALE_REJECTED: PaymentID=${payment_id || 'N/A'}, Ref=${metadata?.reference || 'N/A'}`);
      return new NextResponse('OK (Rejected Handled)', { status: 200 });
    } else {
      console.log(`Bold Webhook: Received unhandled event type: ${eventType}`);
      return new NextResponse('OK (Unhandled Type)', { status: 200 });
    }
  } catch (error) {
    console.error('❌ Top-level Bold Webhook error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}