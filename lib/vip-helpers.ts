// 📁 /lib/vip-helpers.ts - UPDATED WITH PAY-FIRST FLOW SUPPORT
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Types
export interface VipTransaction {
  id: number;
  user_id: string;
  full_name: string;
  email: string;
  plan_id: string;
  order_id: string;
  amount_cop: number;
  payment_status: string;
  bold_payment_id?: string;
  paid_at?: string;
  created_at: string;
  slack_notified?: boolean;
  bold_webhook_received_at?: string;
  manual_confirmation_at?: string;
  // 🔥 NEW: Pay-first flow fields
  pay_first_flow?: boolean;
  requires_account_creation?: boolean;
  customer_email?: string;
  customer_name?: string;
  selected_gp?: string;
}

export interface VipUser {
  id: string;
  joined_at: string;
  entry_tx_id: string;
  full_name?: string;
  email?: string;
  active_plan?: string;
  plan_expires_at?: string;
  race_pass_gp?: string;
  // 🔥 NEW: Pay-first flow fields
  created_via_pay_first?: boolean;
  login_session_token?: string;
}

// 🔥 NEW: Login session interface
export interface VipLoginSession {
  id: string;
  session_token: string;
  clerk_user_id: string;
  order_id: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at?: string;
}

// Create Supabase client helper
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Get consistent user data from clerk_users
export async function getUserData(userId: string) {
  const sb = createServiceClient();
  
  const { data: clerkUser } = await sb
    .from('clerk_users')
    .select('full_name, email')
    .eq('clerk_id', userId)
    .single();
    
  return {
    fullName: clerkUser?.full_name || 'Sin nombre',
    email: clerkUser?.email || ''
  };
}

// 🔥 NEW: Check if user exists by email (for pay-first flow)
export async function findUserByEmail(email: string): Promise<{
  exists: boolean;
  clerkUserId?: string;
  userData?: any;
}> {
  const sb = createServiceClient();
  
  const { data: clerkUser } = await sb
    .from('clerk_users')
    .select('clerk_id, full_name, email')
    .eq('email', email.toLowerCase().trim())
    .single();
    
  if (clerkUser) {
    return {
      exists: true,
      clerkUserId: clerkUser.clerk_id,
      userData: clerkUser
    };
  }
  
  return { exists: false };
}

// Check if user has active VIP access
export async function checkVipAccess(userId: string): Promise<{
  hasAccess: boolean;
  activePlan?: string;
  expiresAt?: string;
  racePassGp?: string;
  createdViaPayFirst?: boolean;
}> {
  const sb = createServiceClient();
  
  const { data: vipUser } = await sb
    .from('vip_users')
    .select('active_plan, plan_expires_at, race_pass_gp, created_via_pay_first')
    .eq('id', userId)
    .single();
    
  if (!vipUser) {
    return { hasAccess: false };
  }
  
  // Check if plan is expired
  if (vipUser.plan_expires_at && new Date(vipUser.plan_expires_at) < new Date()) {
    return { hasAccess: false };
  }
  
  return {
    hasAccess: true,
    activePlan: vipUser.active_plan || undefined,
    expiresAt: vipUser.plan_expires_at || undefined,
    racePassGp: vipUser.race_pass_gp || undefined,
    createdViaPayFirst: vipUser.created_via_pay_first || false
  };
}

// Get user's VIP transaction history
export async function getUserTransactions(userId: string): Promise<VipTransaction[]> {
  const sb = createServiceClient();
  
  const { data, error } = await sb
    .from('vip_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching user transactions:', error);
    return [];
  }
  
  return data || [];
}

// 🔥 NEW: Get transaction by order ID (for pay-first flow)
export async function getTransactionByOrderId(orderId: string): Promise<VipTransaction | null> {
  const sb = createServiceClient();
  
  const { data, error } = await sb
    .from('vip_transactions')
    .select('*')
    .eq('order_id', orderId)
    .single();
    
  if (error) {
    console.error('Error fetching transaction by order ID:', error);
    return null;
  }
  
  return data;
}

// 🔥 NEW: Create or validate login session
export async function createLoginSession(
  clerkUserId: string, 
  orderId: string, 
  expiresInMinutes: number = 15
): Promise<string | null> {
  const sb = createServiceClient();
  
  try {
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    
    const { error } = await sb
      .from('vip_login_sessions')
      .insert({
        session_token: sessionToken,
        clerk_user_id: clerkUserId,
        order_id: orderId,
        expires_at: expiresAt.toISOString(),
        used: false
      });
      
    if (error) {
      console.error('Error creating login session:', error);
      return null;
    }
    
    return sessionToken;
  } catch (error) {
    console.error('Error in createLoginSession:', error);
    return null;
  }
}

// 🔥 NEW: Validate and use login session
export async function validateLoginSession(sessionToken: string, orderId: string): Promise<{
  valid: boolean;
  clerkUserId?: string;
  expired?: boolean;
  alreadyUsed?: boolean;
}> {
  const sb = createServiceClient();
  
  try {
    const { data: session, error } = await sb
      .from('vip_login_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .eq('order_id', orderId)
      .single();
      
    if (error || !session) {
      return { valid: false };
    }
    
    // Check if expired
    if (new Date(session.expires_at) < new Date()) {
      return { 
        valid: false, 
        expired: true,
        clerkUserId: session.clerk_user_id 
      };
    }
    
    // Check if already used
    if (session.used) {
      return { 
        valid: false, 
        alreadyUsed: true,
        clerkUserId: session.clerk_user_id 
      };
    }
    
    // Mark as used
    await sb
      .from('vip_login_sessions')
      .update({ 
        used: true, 
        used_at: new Date().toISOString() 
      })
      .eq('session_token', sessionToken);
    
    return {
      valid: true,
      clerkUserId: session.clerk_user_id
    };
  } catch (error) {
    console.error('Error validating login session:', error);
    return { valid: false };
  }
}

// Format COP currency
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);
}

// Get plan display name
export function getPlanDisplayName(planId: string): string {
  const plans: Record<string, string> = {
    'race-pass': 'Race Pass',
    'season-pass': 'Season Pass'
  };
  return plans[planId] || planId;
}

// 🔥 UPDATED: Calculate plan expiration date with GP support
export function calculatePlanExpiration(planId: string, selectedGp?: string): Date {
  const now = new Date();
  
  if (planId === 'season-pass') {
    // Season pass expires at the end of 2026
    return new Date('2026-12-31T23:59:59Z');
  } else if (planId === 'race-pass') {
    // If we have a specific GP, calculate based on race date
    // For now, default to 30 days (race date calculation would need GP schedule)
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  // Default: 30 days
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}

// Verify if a transaction needs Slack notification
export async function shouldSendSlackNotification(transactionId: number): Promise<boolean> {
  const sb = createServiceClient();
  
  const { data } = await sb
    .from('vip_transactions')
    .select('slack_notified')
    .eq('id', transactionId)
    .single();
    
  return !data?.slack_notified;
}

// 🔥 NEW: Get active GP for race pass
export async function getActiveGP(): Promise<{
  gpName: string | null;
  qualyTime: string | null;
  raceTime: string | null;
}> {
  const sb = createServiceClient();
  
  const { data: gpData } = await sb
    .from('gp_schedule')
    .select('gp_name, qualy_time, race_time')
    .gte('qualy_time', new Date().toISOString())
    .order('race_time', { ascending: true })
    .limit(1)
    .single();
  
  return {
    gpName: gpData?.gp_name || null,
    qualyTime: gpData?.qualy_time || null,
    raceTime: gpData?.race_time || null
  };
}

// 🔥 NEW: Check order status for pay-first flow
export async function checkOrderStatus(orderId: string): Promise<{
  status: 'not_found' | 'pending' | 'paid' | 'failed';
  transaction?: VipTransaction;
  vipUser?: VipUser;
  accountCreated?: boolean;
  loginSessionAvailable?: boolean;
}> {
  const sb = createServiceClient();
  
  try {
    // Get transaction
    const transaction = await getTransactionByOrderId(orderId);
    
    if (!transaction) {
      return { status: 'not_found' };
    }
    
    if (transaction.payment_status === 'failed') {
      return { status: 'failed', transaction };
    }
    
    if (transaction.payment_status === 'pending') {
      return { status: 'pending', transaction };
    }
    
    if (transaction.payment_status === 'paid') {
      // Check if VIP user exists
      const { data: vipUser } = await sb
        .from('vip_users')
        .select('*')
        .eq('id', transaction.user_id)
        .single();
      
      // Check if login session is available
      const { data: loginSession } = await sb
        .from('vip_login_sessions')
        .select('session_token')
        .eq('order_id', orderId)
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      return {
        status: 'paid',
        transaction,
        vipUser: vipUser || undefined,
        accountCreated: !!vipUser,
        loginSessionAvailable: !!loginSession
      };
    }
    
    return { status: 'pending', transaction };
  } catch (error) {
    console.error('Error checking order status:', error);
    return { status: 'not_found' };
  }
}

// 🔥 NEW: Cleanup expired login sessions (utility function)
export async function cleanupExpiredLoginSessions(): Promise<number> {
  const sb = createServiceClient();
  
  try {
    const { data, error } = await sb
      .from('vip_login_sessions')
      .delete()
      .or(`expires_at.lt.${new Date().toISOString()},and(used.eq.true,used_at.lt.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()})`)
      .select('id');
    
    if (error) {
      console.error('Error cleaning up login sessions:', error);
      return 0;
    }
    
    return data?.length || 0;
  } catch (error) {
    console.error('Error in cleanupExpiredLoginSessions:', error);
    return 0;
  }
}