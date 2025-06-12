// 📁 app/api/webhooks/bold-vip/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOLD_SECRET = process.env.BOLD_WEBHOOK_SECRET_KEY!;

// Verify Bold signature
function verifyBold(sig: string, raw: string) {
  const bodyB64 = Buffer.from(raw).toString('base64');
  const expected = crypto
    .createHmac('sha256', BOLD_SECRET)
    .update(bodyB64)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-bold-signature') ?? '';

  console.log('🎯 Bold webhook received');

  if (!verifyBold(sig, raw)) {
    console.error('❌ Invalid Bold signature');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const evt = JSON.parse(raw);
  console.log('🎯 Webhook event:', evt);

  // Handle different event types
  if (evt.type !== 'SALE_APPROVED' && evt.type !== 'PAYMENT_APPROVED') {
    console.log('⏭️ Ignoring event type:', evt.type);
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const data = evt.data;
    const orderId = data.metadata?.reference || data.order_id || data.external_reference;
    
    console.log('🔍 Looking for order:', orderId);

    if (!orderId) {
      console.error('❌ No order ID found in webhook data');
      return NextResponse.json({ ok: true, error: 'No order ID' });
    }

    // Update the vip_transactions table
    const { data: updatedTx, error: updateError } = await sb
      .from('vip_transactions')
      .update({
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        bold_payment_id: data.payment_id || data.id
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating transaction:', updateError);
      
      // Try to find by partial match (in case format is different)
      const { data: transactions } = await sb
        .from('vip_transactions')
        .select('order_id')
        .like('order_id', `%${orderId.slice(-8)}%`);
      
      console.log('🔍 Similar orders found:', transactions);
      
      return NextResponse.json({ ok: true, error: updateError.message });
    }

    console.log('✅ Transaction updated:', updatedTx);

    // Also update vip_entries if you want to keep both systems
    if (updatedTx) {
      await sb
        .from('vip_entries')
        .upsert({
          bold_order_id: data.payment_id || data.id,
          user_id: updatedTx.user_id,
          status: 'approved',
          amount_paid: data.amount?.total || updatedTx.amount_cop,
          currency: data.currency || 'COP'
        }, { onConflict: 'bold_order_id' });

      await sb
        .from('vip_users')
        .upsert({ id: updatedTx.user_id }, { onConflict: 'id' });
    }

    return NextResponse.json({ ok: true, updated: true });

  } catch (err) {
    console.error('❌ Webhook error:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}