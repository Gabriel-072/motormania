// ============================================================================
// FILE 2: /app/api/analytics/vip-dashboard/route.ts  
// FIXED - Proper TypeScript Types
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Define proper types for better type safety
interface DashboardData {
  totalSessions: number;
  funnel: FunnelPoint[];
  dailyStats: DailyStats[];
  dropoffPoints: DropoffPoint[];
  vipConversions: VipConversions;
  vipStats: VipStats;
  eventStats: EventStats;
  funnelInsights: FunnelInsights;
  revenuePerSession: number;
  revenuePerUser: number;
  insights: Insights;
}

interface FunnelPoint {
  percentage: number;
  sessions: number;
  conversionRate: number;
}

interface DailyStats {
  date: string;
  sessions: number;
  users: number;
  events: number;
  videoStarts: number;
  completions: number;
  avgEventsPerSession: number;
}

interface DropoffPoint {
  from: number;
  to: number;
  dropoff: number;
  dropoffRate: number;
}

interface VipConversions {
  totalPurchases: number;
  conversionRate: number;
  revenue: number;
  seasonPassPurchases: number;
  racePassPurchases: number;
  averageOrderValue: number;
}

interface VipStats {
  totalVipUsers: number;
  activeSeasonPass: number;
  activeRacePass: number;
  newVipUsers: number;
}

interface EventStats {
  videoLoads: number;
  videoStarts: number;
  leadQualifications: number;
  contentUnlocks: number;
  videoCompletions: number;
  accederClicks: number;
  stickyButtonClicks: number;
  planViews: number;
  planHovers: number;
  audioEngagements: number;
  fullscreenEngagements: number;
}

interface FunnelInsights {
  loadToStart: number;
  startToQuarter: number;
  quarterToHalf: number;
  halfToComplete: number;
  leadConversionRate: number;
  unlockConversionRate: number;
  completionRate: number;
  audioEngagementRate: number;
  fullscreenEngagementRate: number;
}

interface Insights {
  bestPerformingDay: {
    date: string;
    sessions: number;
  } | null;
  worstDropoffPoint: {
    from: number;
    to: number;
    dropoffRate: number;
  } | null;
  averageSessionLength: number;
  audioEngagementImpact: boolean;
  fullscreenEngagementImpact: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Use the Supabase function we created
    const { data, error } = await supabase
      .rpc('get_vip_dashboard_data', { days_back: days });

    if (error) {
      console.error('Supabase function error:', error);
      return NextResponse.json({ 
        error: 'Database function error', 
        details: error.message 
      }, { status: 500 });
    }

    // Type assertion with proper checking
    const dashboardData = data as Record<string, any>;
    
    if (!dashboardData) {
      return NextResponse.json({
        totalSessions: 0,
        funnel: [],
        dailyStats: [],
        dropoffPoints: [],
        vipConversions: {
          totalPurchases: 0,
          conversionRate: 0,
          revenue: 0,
          seasonPassPurchases: 0,
          racePassPurchases: 0,
          averageOrderValue: 0
        },
        vipStats: {
          totalVipUsers: 0,
          activeSeasonPass: 0,
          activeRacePass: 0,
          newVipUsers: 0
        },
        eventStats: {
          videoLoads: 0,
          videoStarts: 0,
          leadQualifications: 0,
          contentUnlocks: 0,
          videoCompletions: 0,
          accederClicks: 0,
          stickyButtonClicks: 0,
          planViews: 0,
          planHovers: 0,
          audioEngagements: 0,
          fullscreenEngagements: 0
        },
        funnelInsights: {
          loadToStart: 0,
          startToQuarter: 0,
          quarterToHalf: 0,
          halfToComplete: 0,
          leadConversionRate: 0,
          unlockConversionRate: 0,
          completionRate: 0,
          audioEngagementRate: 0,
          fullscreenEngagementRate: 0
        },
        revenuePerSession: 0,
        revenuePerUser: 0,
        insights: {
          bestPerformingDay: null,
          worstDropoffPoint: null,
          averageSessionLength: 0,
          audioEngagementImpact: false,
          fullscreenEngagementImpact: false
        }
      });
    }

    // Safely extract data with proper type checking
    const totalSessions = Number(dashboardData.totalSessions) || 0;
    const funnel = Array.isArray(dashboardData.funnel) ? dashboardData.funnel : [];
    const dailyStats = Array.isArray(dashboardData.dailyStats) ? dashboardData.dailyStats : [];
    const vipConversions = dashboardData.vipConversions || {};
    const eventStats = dashboardData.eventStats || {};
    const dropoffPoints = Array.isArray(dashboardData.dropoffPoints) ? dashboardData.dropoffPoints : [];

    // Calculate daily stats with proper typing
    const dailyStatsArray = dailyStats.map((item: any) => ({
      date: String(item.date || ''),
      sessions: Number(item.sessions) || 0,
      users: Number(item.users) || 0,
      events: Number(item.events) || 0,
      videoStarts: Number(item.videoStarts) || 0,
      completions: Number(item.completions) || 0,
      avgEventsPerSession: Number(item.avgEventsPerSession) || 0
    }));

    // Find best performing day with null safety
    const topPerformingDay = dailyStatsArray.length > 0 
      ? dailyStatsArray.reduce((best: DailyStats | null, day: DailyStats) => 
          !best || day.sessions > best.sessions ? day : best, null)
      : null;

    // Find worst dropoff point with null safety
    const worstDropoffPoint = dropoffPoints.length > 0 
      ? dropoffPoints.reduce((worst: DropoffPoint | null, point: any) => {
          const typedPoint = {
            from: Number(point.from) || 0,
            to: Number(point.to) || 0,
            dropoff: Number(point.dropoff) || 0,
            dropoffRate: Number(point.dropoffRate) || 0
          };
          return !worst || typedPoint.dropoffRate > worst.dropoffRate ? typedPoint : worst;
        }, null)
      : null;

    const response: DashboardData = {
      totalSessions,
      funnel: funnel.map((f: any) => ({
        percentage: Number(f.percentage) || 0,
        sessions: Number(f.sessions) || 0,
        conversionRate: Number(f.conversionRate) || 0
      })),
      dailyStats: dailyStatsArray,
      dropoffPoints: dropoffPoints.map((d: any) => ({
        from: Number(d.from) || 0,
        to: Number(d.to) || 0,
        dropoff: Number(d.dropoff) || 0,
        dropoffRate: Number(d.dropoffRate) || 0
      })),
      vipConversions: {
        totalPurchases: Number(vipConversions.totalPurchases) || 0,
        conversionRate: Number(vipConversions.conversionRate) || 0,
        revenue: Number(vipConversions.revenue) || 0,
        seasonPassPurchases: Number(vipConversions.seasonPassPurchases) || 0,
        racePassPurchases: Number(vipConversions.racePassPurchases) || 0,
        averageOrderValue: Number(vipConversions.averageOrderValue) || 0
      },
      vipStats: {
        totalVipUsers: Number(dashboardData.vipStats?.totalVipUsers) || 0,
        activeSeasonPass: Number(dashboardData.vipStats?.activeSeasonPass) || 0,
        activeRacePass: Number(dashboardData.vipStats?.activeRacePass) || 0,
        newVipUsers: Number(dashboardData.vipStats?.newVipUsers) || 0
      },
      eventStats: {
        videoLoads: Number(eventStats.videoLoads) || 0,
        videoStarts: Number(eventStats.videoStarts) || 0,
        leadQualifications: Number(eventStats.leadQualifications) || 0,
        contentUnlocks: Number(eventStats.contentUnlocks) || 0,
        videoCompletions: Number(eventStats.videoCompletions) || 0,
        accederClicks: Number(eventStats.accederClicks) || 0,
        stickyButtonClicks: Number(eventStats.stickyButtonClicks) || 0,
        planViews: Number(eventStats.planViews) || 0,
        planHovers: Number(eventStats.planHovers) || 0,
        audioEngagements: Number(eventStats.audioEngagements) || 0,
        fullscreenEngagements: Number(eventStats.fullscreenEngagements) || 0
      },
      funnelInsights: {
        loadToStart: Number(dashboardData.funnelInsights?.loadToStart) || 0,
        startToQuarter: Number(dashboardData.funnelInsights?.startToQuarter) || 0,
        quarterToHalf: Number(dashboardData.funnelInsights?.quarterToHalf) || 0,
        halfToComplete: Number(dashboardData.funnelInsights?.halfToComplete) || 0,
        leadConversionRate: Number(dashboardData.funnelInsights?.leadConversionRate) || 0,
        unlockConversionRate: Number(dashboardData.funnelInsights?.unlockConversionRate) || 0,
        completionRate: Number(dashboardData.funnelInsights?.completionRate) || 0,
        audioEngagementRate: Number(dashboardData.funnelInsights?.audioEngagementRate) || 0,
        fullscreenEngagementRate: Number(dashboardData.funnelInsights?.fullscreenEngagementRate) || 0
      },
      revenuePerSession: Number(dashboardData.revenuePerSession) || 0,
      revenuePerUser: Number(dashboardData.revenuePerUser) || 0,
      insights: {
        bestPerformingDay: topPerformingDay ? {
          date: topPerformingDay.date,
          sessions: topPerformingDay.sessions
        } : null,
        worstDropoffPoint,
        averageSessionLength: Number(dashboardData.insights?.averageSessionLength) || 0,
        audioEngagementImpact: Boolean(dashboardData.insights?.audioEngagementImpact),
        fullscreenEngagementImpact: Boolean(dashboardData.insights?.fullscreenEngagementImpact)
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Enhanced VIP dashboard error:', error);
    return NextResponse.json({ 
      error: 'Internal error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}