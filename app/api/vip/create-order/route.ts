// app/api/vip/create-order/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { predictions, gpName, userEmail, userName } = await request.json();

    if (!predictions || !gpName) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // Check if user is already VIP
    const { data: existingVip } = await supabase
      .from('leaderboard')
      .select('is_vip')
      .eq('user_id', userId)
      .single();

    // If user is already VIP, submit prediction directly as VIP
    if (existingVip?.is_vip) {
      const submissionResult = await submitVipPrediction(userId, predictions, gpName);
      
      if (submissionResult.success) {
        return NextResponse.json({
          success: true,
          isExistingVip: true,
          message: 'Predicción VIP enviada (ya eres VIP)'
        });
      } else {
        return NextResponse.json({ error: submissionResult.error }, { status: 500 });
      }
    }

    // Create new VIP order
    const orderId = `vip_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const amount = 20000; // $5 USD = 20,000 COP (approximate)
    
    // Generate Bold signature
    const integritySignature = generateBoldSignature(orderId, amount);
    
    // Store pending VIP order
    const { error: insertError } = await supabase
      .from('vip_orders')
      .insert({
        order_id: orderId,
        user_id: userId,
        gp_name: gpName,
        predictions: predictions,
        amount_cop: amount,
        status: 'pending'
      });

    if (insertError) {
      console.error('Error storing VIP order:', insertError);
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }

    // Return Bold checkout configuration
    return NextResponse.json({
      orderId,
      amount: amount.toString(),
      redirectionUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/fantasy?vip_success=${orderId}`,
      integritySignature,
      currency: 'COP'
    });

  } catch (error) {
    console.error('VIP order creation error:', error);
    return NextResponse.json({ 
      error: 'Error interno del servidor' 
    }, { status: 500 });
  }
}

// Helper function to generate Bold signature
function generateBoldSignature(orderId: string, amount: number): string {
  const secretKey = process.env.BOLD_SECRET_KEY!;
  const data = `${orderId}${amount}COP${secretKey}`;
  
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

// Helper function to submit VIP prediction (for existing VIP users)
async function submitVipPrediction(userId: string, predictions: any, gpName: string) {
  try {
    // Check for existing prediction for this GP and user
    const { data: existingPrediction } = await supabase
      .from('predictions')
      .select('id')
      .eq('user_id', userId)
      .eq('gp_name', gpName)
      .single();

    if (existingPrediction) {
      return { success: false, error: 'Ya tienes una predicción para este GP' };
    }

    // Insert VIP prediction
    const submissionTime = new Date();
    const week = Math.ceil(
      (submissionTime.getTime() - new Date(submissionTime.getFullYear(), 0, 1).getTime()) / 
      (7 * 24 * 60 * 60 * 1000)
    );

    const { error: predictionError } = await supabase
      .from('predictions')
      .insert({
        user_id: userId,
        gp_name: gpName,
        ...predictions,
        is_vip: true,
        submitted_at: submissionTime.toISOString(),
        submission_week: week,
        submission_year: submissionTime.getFullYear()
      });

    if (predictionError) {
      console.error('Error inserting VIP prediction:', predictionError);
      return { success: false, error: 'Error guardando predicción' };
    }

    return { success: true };

  } catch (error) {
    console.error('Error in submitVipPrediction:', error);
    return { success: false, error: 'Error interno al procesar predicción' };
  }
}