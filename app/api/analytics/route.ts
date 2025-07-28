// 📁 app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30'; // days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Get revenue data
    const { data: revenueData } = await sb
      .from('pick_transactions')
      .select('created_at, wager_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString());

    // Get user registration data
    const { data: userData } = await sb
      .from('clerk_users')
      .select('created_at')
      .gte('created_at', startDate.toISOString());

    // 🎯 NEW: Get picks data with UTM attribution
    const { data: picksData } = await sb
      .from('picks')
      .select('created_at, mode, picks, wager_amount, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer')
      .gte('created_at', startDate.toISOString());

    // Get payment method breakdown
    const { data: paymentData } = await sb
      .from('pick_transactions')
      .select('bold_payment_id, paypal_order_id, wager_amount')
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString());

    // Process revenue by day
    const revenueByDay = revenueData?.reduce((acc: any, row: any) => {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      if (!acc[date]) acc[date] = { revenue: 0, transactions: 0 };
      acc[date].revenue += row.wager_amount || 0;
      acc[date].transactions += 1;
      return acc;
    }, {}) || {};

    // Process users by day
    const usersByDay = userData?.reduce((acc: any, row: any) => {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {}) || {};

    // Process payment methods
    const paymentMethods = paymentData?.reduce((acc: any, row: any) => {
      let method = 'Unknown';
      if (row.bold_payment_id) method = 'Bold';
      else if (row.paypal_order_id) method = 'PayPal';
      
      if (!acc[method]) acc[method] = { count: 0, revenue: 0 };
      acc[method].count += 1;
      acc[method].revenue += row.wager_amount || 0;
      return acc;
    }, {}) || {};

    // Process popular drivers
    const driverCounts: Record<string, number> = {};
    picksData?.forEach((pick: any) => {
      if (pick.picks && Array.isArray(pick.picks)) {
        pick.picks.forEach((p: any) => {
          if (p.driver) {
            driverCounts[p.driver] = (driverCounts[p.driver] || 0) + 1;
          }
        });
      }
    });

    const popularDrivers = Object.entries(driverCounts)
      .map(([driver, count]) => ({ driver, pick_count: count }))
      .sort((a, b) => b.pick_count - a.pick_count)
      .slice(0, 10);

    // 🎯 NEW: Process UTM revenue attribution from picks table
    const utmRevenue: Record<string, { revenue: number; purchases: number; source: string; campaign: string }> = {};
    const utmSources: Record<string, { revenue: number; purchases: number }> = {};
    const utmCampaigns: Record<string, { revenue: number; purchases: number; source: string }> = {};

    let attributedRevenue = 0;
    let totalRevenue = 0;
    let attributedPurchases = 0;
    let totalPurchases = 0;

    picksData?.forEach((pick: any) => {
      const revenue = pick.wager_amount || 0;
      totalRevenue += revenue;
      totalPurchases += 1;

      if (pick.utm_source || pick.utm_campaign) {
        attributedRevenue += revenue;
        attributedPurchases += 1;

        // Group by source
        if (pick.utm_source) {
          const source = pick.utm_source;
          if (!utmSources[source]) utmSources[source] = { revenue: 0, purchases: 0 };
          utmSources[source].revenue += revenue;
          utmSources[source].purchases += 1;
        }

        // Group by campaign
        if (pick.utm_campaign) {
          const campaign = pick.utm_campaign;
          if (!utmCampaigns[campaign]) {
            utmCampaigns[campaign] = { 
              revenue: 0, 
              purchases: 0, 
              source: pick.utm_source || 'Unknown' 
            };
          }
          utmCampaigns[campaign].revenue += revenue;
          utmCampaigns[campaign].purchases += 1;
        }

        // Combined source + campaign
        const key = `${pick.utm_source || 'Unknown'} / ${pick.utm_campaign || 'Unknown'}`;
        if (!utmRevenue[key]) {
          utmRevenue[key] = { 
            revenue: 0, 
            purchases: 0, 
            source: pick.utm_source || 'Unknown',
            campaign: pick.utm_campaign || 'Unknown'
          };
        }
        utmRevenue[key].revenue += revenue;
        utmRevenue[key].purchases += 1;
      }
    });

    // Get traffic sources data (visits, not revenue)
    const { data: trafficData } = await sb
      .from('traffic_sources')
      .select('utm_source, utm_medium, utm_campaign, referrer')
      .gte('created_at', startDate.toISOString());

    // Process traffic sources (visits)
    const sourceGroups: Record<string, number> = {};
    const mediumGroups: Record<string, number> = {};
    const campaignGroups: Record<string, number> = {};

    trafficData?.forEach((traffic: any) => {
      const source = traffic.utm_source || getSourceFromReferrer(traffic.referrer) || 'Direct';
      sourceGroups[source] = (sourceGroups[source] || 0) + 1;

      if (traffic.utm_medium) {
        mediumGroups[traffic.utm_medium] = (mediumGroups[traffic.utm_medium] || 0) + 1;
      }

      if (traffic.utm_campaign) {
        campaignGroups[traffic.utm_campaign] = (campaignGroups[traffic.utm_campaign] || 0) + 1;
      }
    });

    const trafficSources = Object.entries(sourceGroups)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    const trafficMediums = Object.entries(mediumGroups)
      .map(([medium, count]) => ({ medium, count }))
      .sort((a, b) => b.count - a.count);

    const trafficCampaigns = Object.entries(campaignGroups)
      .map(([campaign, count]) => ({ campaign, count }))
      .sort((a, b) => b.count - a.count);

    // 🎯 NEW: Format UTM revenue data
    const utmRevenueData = Object.entries(utmRevenue)
      .map(([key, data]) => ({
        source_campaign: key,
        source: data.source,
        campaign: data.campaign,
        revenue: data.revenue,
        purchases: data.purchases,
        avg_purchase: data.purchases > 0 ? Math.round(data.revenue / data.purchases) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const utmSourcesData = Object.entries(utmSources)
      .map(([source, data]) => ({
        source,
        revenue: data.revenue,
        purchases: data.purchases,
        avg_purchase: data.purchases > 0 ? Math.round(data.revenue / data.purchases) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const utmCampaignsData = Object.entries(utmCampaigns)
      .map(([campaign, data]) => ({
        campaign,
        source: data.source,
        revenue: data.revenue,
        purchases: data.purchases,
        avg_purchase: data.purchases > 0 ? Math.round(data.revenue / data.purchases) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Calculate totals
    const totals = {
      total_users: userData?.length || 0,
      total_transactions: revenueData?.length || 0,
      total_revenue: revenueData?.reduce((sum, r) => sum + (r.wager_amount || 0), 0) || 0,
      total_picks: picksData?.length || 0,
      // 🎯 NEW: Attribution metrics
      attributed_revenue: attributedRevenue,
      attribution_rate: totalPurchases > 0 ? Math.round((attributedPurchases / totalPurchases) * 100) : 0,
      attributed_purchases: attributedPurchases
    };

    // Format response
    const response = {
      period: parseInt(period),
      revenue: Object.entries(revenueByDay).map(([date, data]: [string, any]) => ({
        date,
        revenue: data.revenue,
        transactions: data.transactions,
        avg_bet: data.transactions > 0 ? data.revenue / data.transactions : 0
      })).sort((a, b) => a.date.localeCompare(b.date)),
      users: Object.entries(usersByDay).map(([date, count]) => ({
        date,
        new_users: count
      })).sort((a, b) => a.date.localeCompare(b.date)),
      paymentMethods: Object.entries(paymentMethods).map(([method, data]: [string, any]) => ({
        payment_method: method,
        count: data.count,
        revenue: data.revenue
      })),
      popularDrivers,
      trafficSources,
      trafficMediums,
      trafficCampaigns,
      // 🎯 NEW: UTM revenue attribution data
      utmRevenue: utmRevenueData,
      utmSources: utmSourcesData,
      utmCampaigns: utmCampaignsData,
      totals
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to extract source from referrer
function getSourceFromReferrer(referrer: string): string | null {
  if (!referrer) return null;
  
  try {
    const url = new URL(referrer);
    const domain = url.hostname.toLowerCase();
    
    // Internal referrers (same domain)
    if (domain.includes('motormania.app')) {
      const path = url.pathname;
      if (path === '/fantasy') return 'Fantasy Page';
      if (path === '/') return 'Homepage';
      if (path.includes('/blog')) return 'Blog';
      if (path.includes('/dashboard')) return 'Dashboard';
      return `Internal: ${path}`;
    }
    
    // External referrers
    if (domain.includes('google')) return 'Google';
    if (domain.includes('facebook') || domain.includes('fb.com')) return 'Facebook';
    if (domain.includes('instagram')) return 'Instagram';
    if (domain.includes('twitter') || domain.includes('t.co')) return 'Twitter';
    if (domain.includes('youtube')) return 'YouTube';
    if (domain.includes('tiktok')) return 'TikTok';
    if (domain.includes('linkedin')) return 'LinkedIn';
    if (domain.includes('whatsapp')) return 'WhatsApp';
    if (domain.includes('telegram')) return 'Telegram';
    
    return domain;
  } catch {
    return null;
  }
}