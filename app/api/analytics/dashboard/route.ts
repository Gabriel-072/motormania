// FILE 1: /app/api/analytics/dashboard/route.ts
// Complete Enhanced Dashboard API
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get video completion funnel
    const { data: funnelData } = await supabase
      .from('video_analytics')
      .select('video_percentage, session_id, timestamp, page_url, user_id')
      .gte('timestamp', startDate.toISOString())
      .ilike('page_url', '%vip%');

    // Calculate funnel metrics
    const sessions = new Set(funnelData?.map(d => d.session_id) || []);
    const totalSessions = sessions.size;
    
    const milestones = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const funnel = milestones.map(milestone => {
      const sessionsThatReached = new Set(
        funnelData?.filter(d => d.video_percentage >= milestone)
          .map(d => d.session_id) || []
      );
      
      return {
        percentage: milestone,
        sessions: sessionsThatReached.size,
        conversionRate: totalSessions > 0 ? 
          (sessionsThatReached.size / totalSessions * 100) : 0
      };
    });

    // Get daily views with enhanced metrics
    const dailyViews = funnelData?.reduce((acc, item) => {
      const date = new Date(item.timestamp).toDateString();
      if (!acc[date]) {
        acc[date] = {
          sessions: new Set(),
          users: new Set(),
          views: 0
        };
      }
      acc[date].sessions.add(item.session_id);
      if (item.user_id) acc[date].users.add(item.user_id);
      acc[date].views++;
      return acc;
    }, {} as Record<string, { sessions: Set<string>, users: Set<string>, views: number }>) || {};

    const dailyStats = Object.entries(dailyViews).map(([date, data]) => ({
      date,
      sessions: data.sessions.size,
      users: data.users.size,
      views: data.views,
      avgViewsPerSession: data.views / data.sessions.size || 0
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get VIP purchase conversions
    const { data: vipTransactions } = await supabase
      .from('vip_transactions')
      .select('user_id, plan_id, amount_cop, created_at, paid_at, status')
      .gte('created_at', startDate.toISOString());

    const paidTransactions = vipTransactions?.filter(t => t.status === 'paid') || [];

    // Calculate VIP conversion metrics
    const vipConversions = {
      totalPurchases: paidTransactions.length,
      conversionRate: totalSessions > 0 ? 
        (paidTransactions.length / totalSessions * 100) : 0,
      revenue: paidTransactions.reduce((sum, p) => sum + (p.amount_cop || 0), 0),
      seasonPassPurchases: paidTransactions.filter(p => p.plan_id === 'season-pass').length,
      racePassPurchases: paidTransactions.filter(p => p.plan_id === 'race-pass').length,
      averageOrderValue: paidTransactions.length > 0 ? 
        paidTransactions.reduce((sum, p) => sum + (p.amount_cop || 0), 0) / paidTransactions.length : 0
    };

    // Get VIP users stats
    const { data: vipUsers } = await supabase
      .from('vip_users')
      .select('id, active_plan, joined_at, plan_expires_at')
      .gte('joined_at', startDate.toISOString());

    const vipStats = {
      totalVipUsers: vipUsers?.length || 0,
      activeSeasonPass: vipUsers?.filter(u => u.active_plan === 'season-pass').length || 0,
      activeRacePass: vipUsers?.filter(u => u.active_plan === 'race-pass').length || 0,
      newVipUsers: vipUsers?.filter(u => 
        new Date(u.joined_at).getTime() >= startDate.getTime()
      ).length || 0
    };

    // Analyze key conversion points for Facebook events correlation
    const keyPoints = {
      videoStart: funnel.find(f => f.percentage === 10),
      leadQualification: funnel.find(f => f.percentage === 20), // Lead event fires here
      contentUnlock: funnel.find(f => f.percentage === 50), // Auto unlock + content access
      videoComplete: funnel.find(f => f.percentage === 100)
    };

    const funnelInsights = {
      leadConversionRate: keyPoints.leadQualification?.conversionRate || 0,
      unlockConversionRate: keyPoints.contentUnlock?.conversionRate || 0,
      completionRate: keyPoints.videoComplete?.conversionRate || 0,
      
      // Calculate drop-off rates
      startToLead: keyPoints.videoStart && keyPoints.leadQualification ? 
        keyPoints.videoStart.sessions - keyPoints.leadQualification.sessions : 0,
      leadToUnlock: keyPoints.leadQualification && keyPoints.contentUnlock ?
        keyPoints.leadQualification.sessions - keyPoints.contentUnlock.sessions : 0,
      unlockToComplete: keyPoints.contentUnlock && keyPoints.videoComplete ?
        keyPoints.contentUnlock.sessions - keyPoints.videoComplete.sessions : 0
    };

    // Get VIP events for enhanced tracking
    const { data: vipEvents } = await supabase
      .from('vip_events')
      .select('event_type, session_id, timestamp, event_data')
      .gte('timestamp', startDate.toISOString());

    const eventStats = {
      contentUnlocks: vipEvents?.filter(e => e.event_type === 'content_unlock').length || 0,
      leadQualifications: vipEvents?.filter(e => e.event_type === 'lead_qualification').length || 0,
      planViews: vipEvents?.filter(e => e.event_type === 'plan_view').length || 0,
      checkoutInitiations: vipEvents?.filter(e => e.event_type === 'checkout_initiated').length || 0
    };

    // Calculate revenue metrics
    const revenuePerSession = totalSessions > 0 ? vipConversions.revenue / totalSessions : 0;
    const revenuePerUser = vipStats.newVipUsers > 0 ? vipConversions.revenue / vipStats.newVipUsers : 0;

    // Top performing days
    const topDays = dailyStats
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 3);

    // Drop-off analysis
    const dropoffPoints = funnel.map((point, index) => ({
      from: index === 0 ? 0 : milestones[index - 1],
      to: point.percentage,
      dropoff: index === 0 ? 0 : funnel[index - 1].sessions - point.sessions,
      dropoffRate: index === 0 ? 0 : 
        funnel[index - 1].sessions > 0 ? 
          ((funnel[index - 1].sessions - point.sessions) / funnel[index - 1].sessions * 100) : 0
    })).filter(p => p.dropoff > 0);

    return NextResponse.json({
      // Core metrics
      totalSessions,
      funnel,
      dailyStats,
      dropoffPoints,
      
      // VIP conversion data
      vipConversions,
      vipStats,
      eventStats,
      funnelInsights,
      keyPoints,
      
      // Revenue metrics
      revenuePerSession,
      revenuePerUser,
      
      // Performance insights
      topDays,
      
      // Meta/summary
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days: days
      },
      
      // Quick insights
      insights: {
        bestPerformingDay: topDays[0] || null,
        worstDropoffPoint: dropoffPoints.sort((a, b) => b.dropoffRate - a.dropoffRate)[0] || null,
        averageSessionLength: funnel.length > 0 ? 
          funnel.reduce((sum, f) => sum + f.conversionRate, 0) / funnel.length : 0
      }
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    return NextResponse.json({ 
      error: 'Internal error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}