// 📁 /lib/vip-helpers.ts
import { createClient } from '@supabase/supabase-js';

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
}

export interface VipUser {
  id: string;
  joined_at: string;
  entry_tx_id: string;
  full_name?: string;
  email?: string;
  active_plan?: string;
  plan_expires_at?: string;
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

// Check if user has active VIP access
export async function checkVipAccess(userId: string): Promise<{
  hasAccess: boolean;
  activePlan?: string;
  expiresAt?: string;
}> {
  const sb = createServiceClient();
  
  const { data: vipUser } = await sb
    .from('vip_users')
    .select('active_plan, plan_expires_at')
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
    expiresAt: vipUser.plan_expires_at || undefined
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

// Calculate plan expiration date
export function calculatePlanExpiration(planId: string): Date {
  const now = new Date();
  
  if (planId === 'season-pass') {
    // Season pass expires at the end of 2026
    return new Date('2026-12-31T23:59:59Z');
  } else if (planId === 'race-pass') {
    // Race pass expires 30 days from purchase
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