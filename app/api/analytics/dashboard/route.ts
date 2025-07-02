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
      .select('video_percentage, session_id')
      .gte('timestamp', startDate.toISOString());

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

    // Get daily views
    const { data: dailyData } = await supabase
      .from('video_analytics')
      .select('timestamp, session_id')
      .gte('timestamp', startDate.toISOString())
      .eq('video_percentage', 10); // First milestone = video started

    const dailyViews = dailyData?.reduce((acc, item) => {
      const date = new Date(item.timestamp).toDateString();
      acc[date] = (acc[date] || new Set()).add(item.session_id);
      return acc;
    }, {} as Record<string, Set<string>>) || {};

    const dailyStats = Object.entries(dailyViews).map(([date, sessions]) => ({
      date,
      views: sessions.size
    }));

    return NextResponse.json({
      totalSessions,
      funnel,
      dailyStats,
      dropoffPoints: funnel.map((point, index) => ({
        from: index === 0 ? 0 : milestones[index - 1],
        to: point.percentage,
        dropoff: index === 0 ? 0 : funnel[index - 1].sessions - point.sessions
      })).filter(p => p.dropoff > 0)
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}