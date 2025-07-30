// app/api/crypto-webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    // Verify webhook signature (optional but recommended)
    // const signature = request.headers.get('x-cc-webhook-signature');
    
    if (event.type === 'charge:confirmed') {
      const { metadata } = event.data;
      const { orderId, picks, mode, userEmail, userName, originalAmountCOP } = metadata;
      
      console.log('✅ Crypto payment confirmed:', event.data.id);
      
      try {
        // Create admin Supabase client for server-side operations
        const supabase = createAuthClient(null);
        
        // Parse picks data
        const parsedPicks = JSON.parse(picks);
        
        // Save crypto transaction record
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            order_id: orderId,
            user_email: userEmail,
            amount: parseInt(originalAmountCOP),
            status: 'completed',
            payment_method: 'crypto',
            crypto_charge_id: event.data.id,
            created_at: new Date().toISOString()
          });

        if (transactionError) {
          console.error('Transaction save error:', transactionError);
        }

        // Save picks to database (similar to Bold webhook)
        const { error: picksError } = await supabase
          .from('picks')
          .insert({
            order_id: orderId,
            user_email: userEmail,
            user_name: userName,
            picks_data: parsedPicks,
            mode: mode,
            amount: parseInt(originalAmountCOP),
            payment_method: 'crypto',
            status: 'active',
            created_at: new Date().toISOString()
          });

        if (picksError) {
          console.error('Picks save error:', picksError);
        }

        // Send confirmation email
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/picks/email-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userEmail,
            name: userName,
            amount: parseInt(originalAmountCOP),
            mode,
            picks: parsedPicks,
            orderId,
            paymentMethod: 'crypto'
          })
        });

        console.log('✅ Crypto payment processed successfully');
        
      } catch (dbError) {
        console.error('❌ Database/email error:', dbError);
        // Don't throw - return success to Coinbase to avoid retries
      }
    }

    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 400 });
  }
}