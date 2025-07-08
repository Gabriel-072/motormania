// ============================================================================
// /app/api/analytics/vip-dashboard/route.ts  
// FINAL FIXED VERSION - TypeScript Safe
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

// Type guard to check if data is a valid object
function isValidDashboardData(data: unknown): data is Record<string, any> {
  return data !== null && typeof data === 'object' && !Array.isArray(data);
}

// Safe property getter with type checking
function safeGet(obj: unknown, key: string, defaultValue: any = null): any {
  if (isValidDashboardData(obj) && key in obj) {
    return obj[key];
  }
  return defaultValue;
}

// Safe array getter
function safeGetArray(obj: unknown, key: string, defaultValue: any[] = []): any[] {
  const value = safeGet(obj, key, defaultValue);
  return Array.isArray(value) ? value : defaultValue;
}

// Safe number conversion
function safeNumber(value: unknown, defaultValue: number = 0): number {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '7');

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

    // If no data or invalid data, return default structure
    if (!isValidDashboardData(data)) {
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

    // Now TypeScript knows data is a valid object
    const dashboardData = data as Record<string, any>;

    // Safely extract data with proper type checking
    const totalSessions = safeNumber(safeGet(dashboardData, 'totalSessions'), 0);
    const funnel = safeGetArray(dashboardData, 'funnel', []);
    const dailyStats = safeGetArray(dashboardData, 'dailyStats', []);
    const vipConversions = safeGet(dashboardData, 'vipConversions', {});
    const vipStatsData = safeGet(dashboardData, 'vipStats', {});
    const eventStatsData = safeGet(dashboardData, 'eventStats', {});
    const funnelInsightsData = safeGet(dashboardData, 'funnelInsights', {});
    const insightsData = safeGet(dashboardData, 'insights', {});
    const dropoffPoints = safeGetArray(dashboardData, 'dropoffPoints', []);

    // Calculate daily stats with proper typing
    const dailyStatsArray: DailyStats[] = dailyStats.map((item: any) => ({
      date: String(safeGet(item, 'date', '')),
      sessions: safeNumber(safeGet(item, 'sessions'), 0),
      users: safeNumber(safeGet(item, 'users'), 0),
      events: safeNumber(safeGet(item, 'events'), 0),
      videoStarts: safeNumber(safeGet(item, 'videoStarts'), 0),
      completions: safeNumber(safeGet(item, 'completions'), 0),
      avgEventsPerSession: safeNumber(safeGet(item, 'avgEventsPerSession'), 0)
    }));

    // Find best performing day with null safety
    const topPerformingDay = dailyStatsArray.length > 0 
      ? dailyStatsArray.reduce((best: DailyStats | null, day: DailyStats) => 
          !best || day.sessions > best.sessions ? day : best, null)
      : null;

    // Find worst dropoff point with null safety
    const worstDropoffPoint = dropoffPoints.length > 0 
      ? dropoffPoints.reduce((worst: DropoffPoint | null, point: any) => {
          const typedPoint: DropoffPoint = {
            from: safeNumber(safeGet(point, 'from'), 0),
            to: safeNumber(safeGet(point, 'to'), 0),
            dropoff: safeNumber(safeGet(point, 'dropoff'), 0),
            dropoffRate: safeNumber(safeGet(point, 'dropoffRate'), 0)
          };
          return !worst || typedPoint.dropoffRate > worst.dropoffRate ? typedPoint : worst;
        }, null)
      : null;

    const response: DashboardData = {
      totalSessions,
      funnel: funnel.map((f: any) => ({
        percentage: safeNumber(safeGet(f, 'percentage'), 0),
        sessions: safeNumber(safeGet(f, 'sessions'), 0),
        conversionRate: safeNumber(safeGet(f, 'conversionRate'), 0)
      })),
      dailyStats: dailyStatsArray,
      dropoffPoints: dropoffPoints.map((d: any) => ({
        from: safeNumber(safeGet(d, 'from'), 0),
        to: safeNumber(safeGet(d, 'to'), 0),
        dropoff: safeNumber(safeGet(d, 'dropoff'), 0),
        dropoffRate: safeNumber(safeGet(d, 'dropoffRate'), 0)
      })),
      vipConversions: {
        totalPurchases: safeNumber(safeGet(vipConversions, 'totalPurchases'), 0),
        conversionRate: safeNumber(safeGet(vipConversions, 'conversionRate'), 0),
        revenue: safeNumber(safeGet(vipConversions, 'revenue'), 0),
        seasonPassPurchases: safeNumber(safeGet(vipConversions, 'seasonPassPurchases'), 0),
        racePassPurchases: safeNumber(safeGet(vipConversions, 'racePassPurchases'), 0),
        averageOrderValue: safeNumber(safeGet(vipConversions, 'averageOrderValue'), 0)
      },
      vipStats: {
        totalVipUsers: safeNumber(safeGet(vipStatsData, 'totalVipUsers'), 0),
        activeSeasonPass: safeNumber(safeGet(vipStatsData, 'activeSeasonPass'), 0),
        activeRacePass: safeNumber(safeGet(vipStatsData, 'activeRacePass'), 0),
        newVipUsers: safeNumber(safeGet(vipStatsData, 'newVipUsers'), 0)
      },
      eventStats: {
        videoLoads: safeNumber(safeGet(eventStatsData, 'videoLoads'), 0),
        videoStarts: safeNumber(safeGet(eventStatsData, 'videoStarts'), 0),
        leadQualifications: safeNumber(safeGet(eventStatsData, 'leadQualifications'), 0),
        contentUnlocks: safeNumber(safeGet(eventStatsData, 'contentUnlocks'), 0),
        videoCompletions: safeNumber(safeGet(eventStatsData, 'videoCompletions'), 0),
        accederClicks: safeNumber(safeGet(eventStatsData, 'accederClicks'), 0),
        stickyButtonClicks: safeNumber(safeGet(eventStatsData, 'stickyButtonClicks'), 0),
        planViews: safeNumber(safeGet(eventStatsData, 'planViews'), 0),
        planHovers: safeNumber(safeGet(eventStatsData, 'planHovers'), 0),
        audioEngagements: safeNumber(safeGet(eventStatsData, 'audioEngagements'), 0),
        fullscreenEngagements: safeNumber(safeGet(eventStatsData, 'fullscreenEngagements'), 0)
      },
      funnelInsights: {
        loadToStart: safeNumber(safeGet(funnelInsightsData, 'loadToStart'), 0),
        startToQuarter: safeNumber(safeGet(funnelInsightsData, 'startToQuarter'), 0),
        quarterToHalf: safeNumber(safeGet(funnelInsightsData, 'quarterToHalf'), 0),
        halfToComplete: safeNumber(safeGet(funnelInsightsData, 'halfToComplete'), 0),
        leadConversionRate: safeNumber(safeGet(funnelInsightsData, 'leadConversionRate'), 0),
        unlockConversionRate: safeNumber(safeGet(funnelInsightsData, 'unlockConversionRate'), 0),
        completionRate: safeNumber(safeGet(funnelInsightsData, 'completionRate'), 0),
        audioEngagementRate: safeNumber(safeGet(funnelInsightsData, 'audioEngagementRate'), 0),
        fullscreenEngagementRate: safeNumber(safeGet(funnelInsightsData, 'fullscreenEngagementRate'), 0)
      },
      revenuePerSession: safeNumber(safeGet(dashboardData, 'revenuePerSession'), 0),
      revenuePerUser: safeNumber(safeGet(dashboardData, 'revenuePerUser'), 0),
      insights: {
        bestPerformingDay: topPerformingDay ? {
          date: topPerformingDay.date,
          sessions: topPerformingDay.sessions
        } : null,
        worstDropoffPoint,
        averageSessionLength: safeNumber(safeGet(insightsData, 'averageSessionLength'), 0),
        audioEngagementImpact: Boolean(safeGet(insightsData, 'audioEngagementImpact', false)),
        fullscreenEngagementImpact: Boolean(safeGet(insightsData, 'fullscreenEngagementImpact', false))
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