// 📁 app/api/webhooks/bold/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ──────────────────────────────
// 🔐 ENV & Clients
// ──────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOLD_WEBHOOK_SECRET = process.env.BOLD_WEBHOOK_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

// --- Startup Checks ---
if (!supabaseUrl || !supabaseServiceKey) {
    console.error("FATAL ERROR: Supabase Env Vars missing for Bold Webhook.");
}
if (!BOLD_WEBHOOK_SECRET) {
    console.error("FATAL ERROR: BOLD_WEBHOOK_SECRET_KEY env var is not set.");
}
if (!SITE_URL) {
    console.error("FATAL ERROR: NEXT_PUBLIC_SITE_URL env var is not set.");
}
if (!INTERNAL_KEY) {
    console.error("FATAL ERROR: INTERNAL_API_KEY env var is not set.");
}

// Inicializa cliente Supabase con Service Role Key
const sb = createClient(supabaseUrl!, supabaseServiceKey!);

// --- Constantes ---
const EXTRA_COUNT = 5;
const SUPPORT_EMAIL = 'soporte@motormaniacolombia.com';

// ──────────────────────────────
// 1. Signature check Helper
// ──────────────────────────────
async function verify(sig: string, raw: string): Promise<boolean> {
    if (!BOLD_WEBHOOK_SECRET) {
        console.error("BOLD_WEBHOOK_SECRET_KEY not configured.");
        return false;
    }
    try {
        const bodyB64 = Buffer.from(raw).toString('base64');
        const expected = crypto
            .createHmac('sha256', BOLD_WEBHOOK_SECRET)
            .update(bodyB64)
            .digest('hex');
        const sigBuffer = Buffer.from(sig, 'hex');
        const expectedBuffer = Buffer.from(expected, 'hex');
        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (error) {
        console.error("Error during Bold signature verification:", error);
        return false;
    }
}

// ──────────────────────────────
// Utils
// ──────────────────────────────
async function uniqueSix(existing: string[], n: number): Promise<string[]> {
    const pool = new Set(existing);
    const out: string[] = [];
    let attempts = 0;
    while (out.length < n && attempts < (n * 100)) {
        const v = Math.floor(100_000 + Math.random() * 900_000).toString();
        if (!pool.has(v)) { pool.add(v); out.push(v); }
        attempts++;
    }
    if (out.length < n) { console.warn(`uniqueSix: Could only generate ${out.length}/${n} unique numbers.`); }
    return out;
}

// ──────────────────────────────
// 2-A. Compra de NÚMEROS EXTRA Handler
// ──────────────────────────────
async function handleNumberPurchase(db: SupabaseClient, data: any) {
    console.log("[Bold WH]: Handling Number Purchase...");
    const ref = data.metadata?.reference as string;
    const total = data.amount?.total as number;
    const payId = data.payment_id as string;

    if (!ref || total === undefined || !payId) {
        throw new Error('Datos incompletos en webhook para compra de números extra.');
    }

    let userId: string | null = null;
    try {
        const parts = ref.split('-');
        if (parts.length === 4 && parts[0] === 'MM' && parts[1] === 'EXTRA' && parts[2].startsWith('user_')) {
            userId = parts[2];
        } else {
            throw new Error(`Formato inesperado`);
        }
    } catch (e) {
        throw new Error(`No se pudo parsear userId de la referencia "${ref}": ${e instanceof Error ? e.message : e}`);
    }
    if (!userId) throw new Error('UserId inválido o no extraído de la referencia.');

    console.log(`[Bold WH Num]: UserID=${userId}, PaymentID=${payId}, Ref=${ref}`);

    const desc = `Compra de ${EXTRA_COUNT} números extra via Bold (Ref: ${ref}, BoldID:${payId})`;
    console.log("[Bold WH Num]: Checking idempotency...");
    const { data: exists, error: checkErr } = await db.from('transactions').select('id')
        .eq('description', desc).limit(1).maybeSingle();
    if (checkErr) throw new Error(`DB Error (Idempotency check): ${checkErr.message}`);
    if (exists) { console.info(`↩️ [Bold WH Num]: Transacción ya procesada (Idempotencia): ${ref}`); return; }

    console.log(`[Bold WH Num]: Inserting into transactions for ${userId}...`);
    const { error: txErr } = await db.from('transactions').insert({ user_id: userId, type: 'recarga', amount: total, description: desc });
    if (txErr?.code === '23503') { console.error(`[Bold WH Num] DB Error: User ID ${userId} no existe en clerk_users.`); throw txErr; }
    else if (txErr) throw new Error(`DB Error (Insert Transaction): ${txErr.message}`);
    console.log("[Bold WH Num]: Transaction logged.");

    console.log(`[Bold WH Num]: Fetching entries for ${userId}...`);
    const { data: entry, error: entryErr } = await db.from('entries').select('numbers, paid_numbers_count').eq('user_id', userId).maybeSingle();
    if (entryErr) throw new Error(`DB Error (Fetch Entry): ${entryErr.message}`);
    if (!entry) throw new Error(`Usuario ${userId} no encontrado en entries.`);

    console.log(`[Bold WH Num]: Generating ${EXTRA_COUNT} unique numbers...`);
    const existingNumbers = entry.numbers ?? [];
    const newNumbers = await uniqueSix(existingNumbers, EXTRA_COUNT);
    const merged = [...existingNumbers, ...newNumbers];
    const newPaidCount = (entry.paid_numbers_count ?? 0) + EXTRA_COUNT;

    console.log(`[Bold WH Num]: Upserting entries for ${userId}...`);
    const { error: upsertErr } = await db.from('entries').upsert({
        user_id: userId, numbers: merged, paid_numbers_count: newPaidCount
    }, { onConflict: 'user_id' });
    if (upsertErr) throw new Error(`DB Error (Upsert Entry): ${upsertErr.message}`);
    console.log("[Bold WH Num]: Entries updated.");

    console.log(`[Bold WH Num]: Fetching email for ${userId}...`);
    const { data: u, error: userFetchErr } = await db.from('clerk_users').select('email, full_name').eq('clerk_id', userId).maybeSingle();
    if (userFetchErr) { console.warn(`[Bold WH Num]: Could not fetch user email (User: ${userId}): ${userFetchErr.message}`); }

    if (u?.email && SITE_URL) {
        console.log(`[Bold WH Num]: Triggering confirmation email to ${u.email}...`);
        fetch(`${SITE_URL}/api/send-numbers-confirmation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-key': INTERNAL_KEY!
            },
            body: JSON.stringify({
                to: u.email,
                name: u.full_name || 'Usuario',
                numbers: newNumbers,
                context: 'compra',
                orderId: ref,
                amount: total
            })
        }).catch(e => console.error('✉️ [Bold WH Num]: Failed to trigger Email API:', e));
    } else {
        console.warn(`[Bold WH Num]: Email not sent for ${userId}: Email address or SITE_URL missing.`);
    }

    console.log('✅ [Bold WH Num]: Extra numbers processed successfully for', ref);
}

// ──────────────────────────────
// 2-B. Compra de PICKS (MMC-GO) Handler
// ──────────────────────────────
async function handlePickPurchase(db: SupabaseClient, data: any) {
    console.log("[Bold WH]: Handling Pick Purchase...");
    const ref = data.metadata?.reference as string;
    const payId = data.payment_id as string;

    if (!ref) throw new Error('Referencia (orderId) faltante en webhook de compra de picks.');
    if (!payId) throw new Error('Payment ID de Bold faltante.');

    console.log(`[Bold WH Pick]: Processing Ref: ${ref}, PaymentID: ${payId}`);

    console.log(`[Bold WH Pick]: Finding pending pick transaction with order_id: ${ref}...`);
    const { data: tx, error: findTxErr } = await db.from('pick_transactions')
        .select('*').eq('order_id', ref).maybeSingle();

    if (findTxErr) throw new Error(`DB Error (Find pick_transactions): ${findTxErr.message}`);
    if (!tx) {
        console.warn(`[Bold WH Pick]: pick_transactions con order_id ${ref} no encontrada. ¿Webhook muy rápido o error al guardar picks pendientes?`);
        return;
    }
    if (tx.payment_status === 'paid') {
        console.info(`↩️ [Bold WH Pick]: Pick transaction ${ref} ya marcada como 'paid'. Evento duplicado.`);
        return;
    }
    console.log(`[Bold WH Pick]: Found pending tx ID: ${tx.id} for User: ${tx.user_id}`);

    console.log(`[Bold WH Pick]: Updating pick_transactions ${tx.id} to paid...`);
    const { error: updateTxErr } = await db.from('pick_transactions')
        .update({ payment_status: 'paid', bold_payment_id: payId }).eq('id', tx.id);
    if (updateTxErr) throw new Error(`DB Error (Update pick_transactions): ${updateTxErr.message}`);
    console.log("[Bold WH Pick]: pick_transactions marked paid.");

    console.log(`[Bold WH Pick]: Inserting into picks table for user ${tx.user_id}...`);
    const { error: insertPickErr } = await db.from('picks').insert({
        user_id: tx.user_id, gp_name: tx.gp_name, session_type: 'combined',
        picks: tx.picks ?? [], multiplier: Number(tx.multiplier ?? 0),
        wager_amount: tx.wager_amount ?? 0, potential_win: tx.potential_win ?? 0,
        name: tx.full_name, mode: tx.mode, order_id: ref,
        pick_transaction_id: tx.id
    });
    if (insertPickErr) throw new Error(`DB Error (Insert Picks): ${insertPickErr.message}`);
    console.log("[Bold WH Pick]: Picks inserted.");

    if (tx.wager_amount && tx.user_id) {
        const mmcCoinsToAdd = Math.round(tx.wager_amount / 1000);
        const fuelCoinsToAdd = tx.wager_amount;
        console.log(`[Bold WH Pick]: Calling RPC increment_wallet_balances for user ${tx.user_id}...`);
        const { error: rpcError } = await db.rpc('increment_wallet_balances', {
            uid: tx.user_id, mmc_amount: mmcCoinsToAdd, fuel_amount: fuelCoinsToAdd, cop_amount: tx.wager_amount
        });
        if (rpcError) { console.warn(`[Bold WH Pick] DB Warning (RPC Wallet ${tx.user_id}): ${rpcError.message}`); }
        else { console.log(`[Bold WH Pick]: Wallet balances incremented for user ${tx.user_id}.`); }
    }

    if (tx.email && SITE_URL) {
        console.log(`[Bold WH Pick]: Triggering pick confirmation email to ${tx.email}...`);
        fetch(`${SITE_URL}/api/send-pick-confirmation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-key': INTERNAL_KEY!
            },
            body: JSON.stringify({
                to: tx.email,
                name: tx.full_name || 'Jugador',
                amount: tx.wager_amount,
                mode: tx.mode,
                picks: tx.picks,
                orderId: ref
            })
        }).catch(e => console.error('✉️ [Bold WH Pick]: Failed to trigger Email API for picks:', e));
    } else {
        console.warn(`[Bold WH Pick]: Email not sent for pick confirmation ${ref}: Email or SITE_URL missing.`);
    }

    console.log('✅ [Bold WH Pick]: Pick transaction processed successfully for', ref);
}

// ──────────────────────────────
// 3. Entrypoint POST Handler
// ──────────────────────────────
export async function POST(req: NextRequest) {
    console.log("Bold Webhook: Request received.");
    let rawBody: string;
    try {
        rawBody = await req.text();
        const sig = req.headers.get('x-bold-signature') ?? '';

        console.log("Bold Webhook: Verifying signature...");
        const isValid = await verify(sig, rawBody);
        if (!isValid) { console.warn("⚠️ Invalid Bold webhook signature."); return new NextResponse('Invalid signature', { status: 401 }); }
        console.log("Bold Webhook: Signature verified.");

        const evt = JSON.parse(rawBody);
        console.log(`Bold Webhook: Processing event type: ${evt.type}`);

        if (evt.type !== 'SALE_APPROVED') {
            console.log(`Bold Webhook: Event type ${evt.type} ignored.`);
            return NextResponse.json({ ok: true, message: "Event ignored" });
        }

        const ref: string = evt.data?.metadata?.reference ?? '';
        if (!ref) {
            console.warn("Bold Webhook Warning: SALE_APPROVED received without metadata.reference.");
            return NextResponse.json({ ok: true, message: "Reference missing" });
        }

        console.log(`Bold Webhook: Routing reference: ${ref}`);
        if (ref.startsWith('MM-EXTRA-')) {
            await handleNumberPurchase(sb, evt.data);
        } else if (ref.startsWith('MMC-')) {
            await handlePickPurchase(sb, evt.data);
        } else {
            console.warn(`Bold Webhook: Referencia desconocida o inesperada: ${ref}`);
        }

        return NextResponse.json({ ok: true, message: "Webhook received and processed/routed." });

    } catch (e) {
        console.error('❌ Bold Webhook Error:', e instanceof Error ? e.message : e);
        return NextResponse.json({ ok: false, error: "Internal processing error occurred." }, { status: 200 });
    }
}