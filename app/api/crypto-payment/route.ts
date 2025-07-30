// app/api/crypto-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { amount, picks, mode, userEmail, userName, orderId } = await request.json();

    const response = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': process.env.COINBASE_COMMERCE_API_KEY!,
        'X-CC-Version': '2018-03-22'
      },
      body: JSON.stringify({
        name: `MMC GO - ${picks.length} picks`,
        description: `${mode === 'full' ? 'Full Throttle' : 'Safety Car'} (${picks.length} selections)`,
        local_price: {
          amount: (amount / 4000).toFixed(2), // Convert COP to USD
          currency: 'USD'
        },
        pricing_type: 'fixed_price',
        metadata: {
          orderId,
          picks: JSON.stringify(picks),
          mode,
          userEmail,
          userName,
          originalAmountCOP: amount,
          platform: 'mmc-go'
        },
        redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?crypto=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/mmc-go`
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Coinbase API error:', errorData);
      throw new Error('Failed to create crypto payment');
    }

    const charge = await response.json();
    
    return NextResponse.json({
      chargeId: charge.data.id,
      checkoutUrl: charge.data.hosted_url,
      addresses: charge.data.addresses,
      success: true
    });

  } catch (error) {
    console.error('Crypto payment creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create crypto payment', success: false }, 
      { status: 500 }
    );
  }
}