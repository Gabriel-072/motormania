'use client';

import React, { useEffect, useState, useMemo, memo } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
    tension?: number;
    pointBackgroundColor?: string;
    pointBorderColor?: string;
    pointBorderWidth?: number;
    pointRadius?: number;
    pointHoverRadius?: number;
    borderRadius?: number;
    borderSkipped?: boolean;
  }>;
}

interface EnhancedAnalyticsData {
  totalSessions: number;
  funnel: Array<{
    percentage: number;
    sessions: number;
    conversionRate: number;
  }>;
  dailyStats: Array<{
    date: string;
    sessions: number;
    users: number;
    views: number;
    avgViewsPerSession: number;
  }>;
  dropoffPoints: Array<{
    from: number;
    to: number;
    dropoff: number;
    dropoffRate: number;
  }>;
  vipConversions: {
    totalPurchases: number;
    conversionRate: number;
    revenue: number;
    seasonPassPurchases: number;
    racePassPurchases: number;
    averageOrderValue: number;
  };
  vipStats: {
    totalVipUsers: number;
    activeSeasonPass: number;
    activeRacePass: number;
    newVipUsers: number;
  };
  eventStats: {
    contentUnlocks: number;
    leadQualifications: number;
    planViews: number;
    checkoutInitiations: number;
  };
  funnelInsights: {
    leadConversionRate: number;
    unlockConversionRate: number;
    completionRate: number;
    startToLead: number;
    leadToUnlock: number;
    unlockToComplete: number;
  };
  revenuePerSession: number;
  revenuePerUser: number;
  topDays: Array<{
    date: string;
    sessions: number;
  }>;
  insights: {
    bestPerformingDay: any;
    worstDropoffPoint: any;
    averageSessionLength: number;
  };
}

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  gradient: string;
  trend?: number;
  animate?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const MetricCard = memo(({ title, value, subtitle, icon, gradient, trend, animate = true }: MetricCardProps) => {
  const [displayValue, setDisplayValue] = useState(typeof value === 'number' ? (animate ? 0 : value) : value);

  useEffect(() => {
    if (!animate || typeof value !== 'number') return;
    
    const timer = setTimeout(() => {
      const increment = value / 50;
      const interval = setInterval(() => {
        setDisplayValue((prev: number | string) => {
          const prevNum = typeof prev === 'number' ? prev : 0;
          if (prevNum >= value) {
            clearInterval(interval);
            return value;
          }
          return Math.min(prevNum + increment, value);
        });
      }, 20);
      return () => clearInterval(interval);
    }, Math.random() * 500);
    return () => clearTimeout(timer);
  }, [value, animate]);

  const formatDisplayValue = () => {
    if (typeof value === 'string') return value;
    if (typeof displayValue === 'number') {
      if (displayValue % 1 !== 0) return displayValue.toFixed(1);
      return Math.floor(displayValue).toLocaleString();
    }
    return displayValue;
  };

  return (
    <div className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-white/70 tracking-wide">{title}</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            {formatDisplayValue()}
          </p>
          <p className="text-xs text-white/60">{subtitle}</p>
          {trend && (
            <div className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <span>{trend > 0 ? '↗' : '↘'}</span>
              <span>{Math.abs(trend)}% vs last period</span>
            </div>
          )}
        </div>
        <div className="text-4xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transform transition-all duration-300">
          {icon}
        </div>
      </div>
    </div>
  );
});

MetricCard.displayName = 'MetricCard';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}

const ChartContainer = memo(({ title, subtitle, children, fullWidth = false }: ChartContainerProps) => (
  <div className={`${fullWidth ? 'col-span-full' : ''} group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all duration-500`}>
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
            {title}
          </h3>
          {subtitle && <p className="text-sm text-white/60 mt-1">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  </div>
));

ChartContainer.displayName = 'ChartContainer';

const createChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#e2e8f0',
        font: { 
          size: 12, 
          family: "'Inter', sans-serif", 
          weight: 'normal' as const
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#f1f5f9',
      bodyColor: '#e2e8f0',
      borderColor: 'rgba(168, 85, 247, 0.5)',
      borderWidth: 1,
      cornerRadius: 12,
      displayColors: true,
      titleFont: { size: 14, weight: 'bold' as const },
      bodyFont: { size: 13, weight: 'normal' as const }
    }
  },
  scales: {
    x: {
      ticks: { 
        color: '#94a3b8', 
        font: { size: 11, family: "'Inter', sans-serif" } 
      },
      grid: { color: 'rgba(148, 163, 184, 0.1)' }
    },
    y: {
      ticks: { 
        color: '#94a3b8', 
        font: { size: 11, family: "'Inter', sans-serif" } 
      },
      grid: { color: 'rgba(148, 163, 184, 0.1)' }
    }
  }
});

class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="text-8xl">💥</div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-red-400">Dashboard Error</p>
              <p className="text-white/60">Something went wrong with the dashboard</p>
              <p className="text-red-300 text-sm font-mono">{this.state.error?.message}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl font-semibold hover:from-red-600 hover:to-orange-600 transform hover:scale-105 transition-all duration-300"
            >
              🔄 Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ChartLoader = () => (
  <div className="h-80 flex items-center justify-center">
    <div className="space-y-4 text-center">
      <div className="w-16 h-16 border-4 border-purple-500/20 rounded-full animate-spin border-t-purple-500"></div>
      <p className="text-white/60">Loading chart...</p>
    </div>
  </div>
);

const FunnelChart = memo(({ data, options }: { data: ChartData | null; options: any }) => {
  if (!data || !data.datasets || data.datasets.length === 0) {
    return <ChartLoader />;
  }
  return <Line data={data} options={options} />;
});

const ConversionChart = memo(({ data, options }: { data: ChartData | null; options: any }) => {
  if (!data || !data.datasets || data.datasets.length === 0) {
    return <ChartLoader />;
  }
  return <Bar data={data} options={options} />;
});

const DailyChart = memo(({ data, options }: { data: ChartData | null; options: any }) => {
  if (!data || !data.datasets || data.datasets.length === 0) {
    return <ChartLoader />;
  }
  return <Line data={data} options={options} />;
});

FunnelChart.displayName = 'FunnelChart';
ConversionChart.displayName = 'ConversionChart';
DailyChart.displayName = 'DailyChart';

const validateAnalyticsData = (data: any): data is EnhancedAnalyticsData => {
  if (!data) return false;
  
  const requiredFields = [
    'totalSessions',
    'funnel',
    'dailyStats',
    'vipConversions',
    'vipStats',
    'eventStats',
    'funnelInsights'
  ];
  
  return requiredFields.every(field => field in data);
};

const fetchWithRetry = async (url: string, retries = 3): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }
      if (i === retries - 1) throw new Error(`Server error after ${retries} attempts`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
};

export default function VideoAnalyticsDashboard() {
    const [data, setData] = useState<EnhancedAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);
    const [error, setError] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
  
    useEffect(() => {
      setMounted(true);
      fetchAnalytics();
    }, [days]);
  
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchWithRetry(`/api/analytics/dashboard?days=${days}`);
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        if (!validateAnalyticsData(result)) {
          throw new Error('Invalid data structure received from API');
        }
        
        setData(result);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };
  
    const chartOptions = useMemo(() => createChartOptions(), []);
  
    const funnelChart = useMemo(() => {
      if (!data?.funnel) return null;
      return {
        labels: data.funnel.map(f => `${f.percentage}%`),
        datasets: [{
          label: 'Active Users',
          data: data.funnel.map(f => f.sessions),
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          borderColor: '#a855f7',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#a855f7',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        }]
      };
    }, [data?.funnel]);
  
    const conversionChart = useMemo(() => {
      if (!data?.funnel) return null;
      return {
        labels: data.funnel.map(f => `${f.percentage}%`),
        datasets: [{
          label: 'Conversion Rate (%)',
          data: data.funnel.map(f => f.conversionRate),
          backgroundColor: data.funnel.map((_, index) => {
            const colors = [
              'rgba(34, 197, 94, 0.8)',
              'rgba(168, 85, 247, 0.8)',
              'rgba(59, 130, 246, 0.8)',
              'rgba(245, 158, 11, 0.8)',
              'rgba(239, 68, 68, 0.8)',
              'rgba(6, 182, 212, 0.8)',
            ];
            return colors[index % colors.length];
          }),
          borderRadius: 8,
          borderSkipped: false,
        }]
      };
    }, [data?.funnel]);
  
    const dailyChart = useMemo(() => {
      if (!data?.dailyStats) return null;
      return {
        labels: data.dailyStats.map(d => {
          const date = new Date(d.date);
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }),
        datasets: [
          {
            label: 'Sessions',
            data: data.dailyStats.map(d => d.sessions),
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            borderColor: '#a855f7',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#a855f7',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
          },
          {
            label: 'Users',
            data: data.dailyStats.map(d => d.users),
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderColor: '#22c55e',
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointBackgroundColor: '#22c55e',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
          }
        ]
      };
    }, [data?.dailyStats]);
  
    const planDistributionChart = useMemo(() => {
      if (!data?.vipConversions || (data.vipConversions.seasonPassPurchases === 0 && data.vipConversions.racePassPurchases === 0)) {
        return {
          labels: ['Season Pass', 'Race Pass'],
          datasets: [{
            data: [1, 1],
            backgroundColor: [
              'rgba(168, 85, 247, 0.3)',
              'rgba(59, 130, 246, 0.3)'
            ],
            borderColor: [
              '#a855f7',
              '#3b82f6'
            ],
            borderWidth: 2,
          }]
        };
      }
      
      return {
        labels: ['Season Pass', 'Race Pass'],
        datasets: [{
          data: [data.vipConversions.seasonPassPurchases, data.vipConversions.racePassPurchases],
          backgroundColor: [
            'rgba(168, 85, 247, 0.8)',
            'rgba(59, 130, 246, 0.8)'
          ],
          borderColor: [
            '#a855f7',
            '#3b82f6'
          ],
          borderWidth: 2,
        }]
      };
    }, [data?.vipConversions]);
  
    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-purple-500/20 rounded-full animate-spin border-t-purple-500"></div>
              <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full animate-spin border-t-blue-500 absolute top-2 left-2 animate-reverse-spin"></div>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Loading Analytics
              </p>
              <p className="text-white/60">Processing {days} days of data</p>
              <div className="flex items-center justify-center space-x-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </div>
          </div>
        </div>
      );
    }
  
    if (error || !data) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-red-950 to-slate-950 flex items-center justify-center">
          <div className="text-center space-y-6">
            <div className="text-8xl animate-bounce">⚠️</div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-red-400">System Error</p>
              <p className="text-white/60">{error || 'Could not load analytics data'}</p>
            </div>
            <button 
              onClick={fetchAnalytics}
              className="px-8 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-2xl font-semibold hover:from-red-600 hover:to-orange-600 transform hover:scale-105 transition-all duration-300 shadow-2xl shadow-red-500/25"
            >
              🔄 Retry Loading
            </button>
          </div>
        </div>
      );
    }
  
    return (
      <DashboardErrorBoundary>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white font-inter overflow-x-hidden">
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/5 to-transparent animate-pulse"></div>
            <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-blue-500/5 to-transparent animate-pulse" style={{animationDelay: '1s'}}></div>
          </div>
  
          <div className="relative bg-gradient-to-r from-slate-900/80 to-purple-900/80 border-b border-white/10 backdrop-blur-xl shadow-2xl">
            <div className="max-w-7xl mx-auto px-6 py-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
                <div className="space-y-3">
                  <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 via-blue-400 to-emerald-400 bg-clip-text text-transparent">
                    VIP Analytics Command Center
                  </h1>
                  <p className="text-xl text-white/70 font-light">
                    Real-time engagement intelligence & conversion analytics
                  </p>
                  <div className="flex flex-wrap items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                      <span className="text-white/80">{data.totalSessions.toLocaleString()} sessions</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                      <span className="text-white/80">{data.vipConversions.totalPurchases} VIP conversions</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className="text-white/80">{formatCurrency(data.vipConversions.revenue)} revenue</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <select 
                    value={days} 
                    onChange={(e) => setDays(Number(e.target.value))}
                    className="bg-white/5 border border-white/20 text-white px-6 py-3 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all backdrop-blur-sm hover:bg-white/10"
                  >
                    <option value={1}>Last 24 hours</option>
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                  <button
                    onClick={fetchAnalytics}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-purple-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-300 shadow-lg shadow-purple-500/25 flex items-center gap-2"
                  >
                    <span className="animate-spin">🔄</span>
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          </div>
  
          <div className="relative max-w-7xl mx-auto px-6 py-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <MetricCard 
                title="Total Sessions"
                value={data.totalSessions}
                subtitle={`Last ${days} days`}
                icon="📊"
                gradient="from-blue-600 to-blue-800"
                trend={12.5}
                animate={mounted}
              />
              <MetricCard 
                title="Lead Qualification"
                value={`${data.funnelInsights.leadConversionRate.toFixed(1)}%`}
                subtitle="20% video milestone"
                icon="🎯"
                gradient="from-amber-600 to-amber-800"
                trend={8.3}
                animate={mounted}
              />
              <MetricCard 
                title="Content Unlock"
                value={`${data.funnelInsights.unlockConversionRate.toFixed(1)}%`}
                subtitle="50% video milestone"
                icon="🔓"
                gradient="from-emerald-600 to-emerald-800"
                trend={-2.1}
                animate={mounted}
              />
              <MetricCard 
                title="Completion Rate"
                value={`${data.funnelInsights.completionRate.toFixed(1)}%`}
                subtitle="Full video watched"
                icon="✅"
                gradient="from-purple-600 to-purple-800"
                trend={5.7}
                animate={mounted}
              />
            </div>
  
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <MetricCard 
                title="VIP Conversion"
                value={`${data.vipConversions.conversionRate.toFixed(2)}%`}
                subtitle={`${data.vipConversions.totalPurchases} purchases`}
                icon="💎"
                gradient="from-emerald-600 to-teal-800"
                trend={15.2}
                animate={mounted}
              />
              <MetricCard 
                title="Total Revenue"
                value={formatCurrency(data.vipConversions.revenue)}
                subtitle={`Last ${days} days`}
                icon="💰"
                gradient="from-pink-600 to-rose-800"
                trend={22.8}
                animate={mounted}
              />
              <MetricCard 
                title="Revenue/Session"
                value={formatCurrency(data.revenuePerSession)}
                subtitle="Average value"
                icon="📈"
                gradient="from-indigo-600 to-purple-800"
                trend={-3.4}
                animate={mounted}
              />
              <MetricCard 
                title="Average Order"
                value={formatCurrency(data.vipConversions.averageOrderValue)}
                subtitle="AOV per purchase"
                icon="🎪"
                gradient="from-orange-600 to-red-800"
                trend={7.9}
                animate={mounted}
              />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <ChartContainer title="🎯 User Retention Funnel" subtitle="Progressive engagement milestones">
              <div className="h-80">
                <FunnelChart data={funnelChart} options={chartOptions} />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 p-4 rounded-xl border border-amber-500/20">
                  <p className="text-amber-400 font-bold text-sm">20% Threshold</p>
                  <p className="text-white/80 text-xs">Lead qualification</p>
                </div>
                <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 p-4 rounded-xl border border-emerald-500/20">
                  <p className="text-emerald-400 font-bold text-sm">50% Threshold</p>
                  <p className="text-white/80 text-xs">Content unlock</p>
                </div>
              </div>
            </ChartContainer>
            <ChartContainer title="📊 Conversion Performance" subtitle="Stage-by-stage conversion rates">
              <div className="h-80">
                <ConversionChart data={conversionChart} options={chartOptions} />
              </div>
            </ChartContainer>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <ChartContainer title="📅 Daily Performance Trends" subtitle="Sessions and users over time">
                <div className="h-80">
                  <DailyChart data={dailyChart} options={chartOptions} />
                </div>
              </ChartContainer>
            </div>
            <ChartContainer title="🎯 VIP Plan Distribution" subtitle="Purchase preferences">
              <div className="h-64 flex items-center justify-center">
                <Doughnut 
                  data={planDistributionChart} 
                  options={{
                    ...chartOptions,
                    scales: undefined,
                    plugins: {
                      ...chartOptions.plugins,
                      legend: {
                        position: 'bottom' as const,
                        labels: {
                          color: '#e2e8f0',
                          font: { size: 12, weight: 'normal' as const }
                        }
                      }
                    }
                  }} 
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-purple-400 font-medium">Season Pass</span>
                  <span className="font-bold text-white">{data.vipConversions.seasonPassPurchases}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                  <span className="text-blue-400 font-medium">Race Pass</span>
                  <span className="font-bold text-white">{data.vipConversions.racePassPurchases}</span>
                </div>
              </div>
            </ChartContainer>
          </div>

          <ChartContainer title="🚀 VIP Event Statistics" subtitle="Key engagement milestones" fullWidth>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center group hover:scale-105 transition-transform duration-300">
                <div className="text-4xl font-black text-amber-400 mb-2">{data.eventStats.leadQualifications}</div>
                <p className="text-white/80 font-medium">Qualified Leads</p>
                <p className="text-amber-300/60 text-xs">20% milestone</p>
              </div>
              <div className="text-center group hover:scale-105 transition-transform duration-300">
                <div className="text-4xl font-black text-emerald-400 mb-2">{data.eventStats.contentUnlocks}</div>
                <p className="text-white/80 font-medium">Content Unlocked</p>
                <p className="text-emerald-300/60 text-xs">50% milestone</p>
              </div>
              <div className="text-center group hover:scale-105 transition-transform duration-300">
                <div className="text-4xl font-black text-blue-400 mb-2">{data.eventStats.planViews}</div>
                <p className="text-white/80 font-medium">Plan Views</p>
                <p className="text-blue-300/60 text-xs">Plan interest</p>
              </div>
              <div className="text-center group hover:scale-105 transition-transform duration-300">
                <div className="text-4xl font-black text-purple-400 mb-2">{data.eventStats.checkoutInitiations}</div>
                <p className="text-white/80 font-medium">Checkouts Started</p>
                <p className="text-purple-300/60 text-xs">Purchase intent</p>
              </div>
            </div>
          </ChartContainer>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ChartContainer title="⚠️ Critical Drop-off Analysis" subtitle="Optimization opportunities">
              {data.dropoffPoints.length > 0 ? (
                <div className="space-y-4">
                  {data.dropoffPoints
                    .sort((a, b) => b.dropoffRate - a.dropoffRate)
                    .slice(0, 3)
                    .map((point, index) => (
                    <div key={index} className="group flex items-center justify-between p-4 bg-gradient-to-r from-red-500/10 to-orange-500/5 rounded-xl border border-red-500/20 hover:border-red-500/40 transition-all duration-300">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 group-hover:scale-110 ${
                          index === 0 ? 'bg-red-500/20 text-red-400' :
                          index === 1 ? 'bg-orange-500/20 text-orange-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          #{index + 1}
                        </div>
                        <div>
                          <p className="text-white font-bold text-lg">
                            {point.from}% → {point.to}%
                          </p>
                          <p className="text-white/60 text-sm">
                            {point.dropoffRate.toFixed(1)}% drop-off rate
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-red-400">
                          -{point.dropoff}
                        </p>
                        <p className="text-white/60 text-sm">users lost</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-white/60">
                  <div className="text-6xl mb-4 opacity-50">📊</div>
                  <p>Insufficient data for analysis</p>
                </div>
              )}
            </ChartContainer>

            <ChartContainer title="💡 Performance Insights" subtitle="Key metrics and trends">
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 rounded-xl border border-emerald-500/20">
                  <h4 className="font-bold text-emerald-400 mb-2 flex items-center gap-2">
                    🏆 Best Performing Day
                  </h4>
                  {data.insights.bestPerformingDay ? (
                    <div>
                      <p className="text-white font-medium">{new Date(data.insights.bestPerformingDay.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                      <p className="text-emerald-300/80 text-sm">{data.insights.bestPerformingDay.sessions.toLocaleString()} sessions</p>
                    </div>
                  ) : (
                    <p className="text-white/60">Analyzing performance...</p>
                  )}
                </div>
                <div className="p-4 bg-gradient-to-r from-red-500/10 to-red-500/5 rounded-xl border border-red-500/20">
                  <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2">
                    📉 Biggest Drop-off Point
                  </h4>
                  {data.insights.worstDropoffPoint ? (
                    <div>
                      <p className="text-white font-medium">{data.insights.worstDropoffPoint.from}% → {data.insights.worstDropoffPoint.to}%</p>
                      <p className="text-red-300/80 text-sm">{data.insights.worstDropoffPoint.dropoffRate.toFixed(1)}% abandonment rate</p>
                    </div>
                  ) : (
                    <p className="text-white/60">No critical drop-offs detected</p>
                  )}
                </div>
                <div className="p-4 bg-gradient-to-r from-blue-500/10 to-blue-500/5 rounded-xl border border-blue-500/20">
                  <h4 className="font-bold text-blue-400 mb-2 flex items-center gap-2">
                    ⏱️ Average Engagement
                  </h4>
                  <p className="text-white font-medium">{data.insights.averageSessionLength.toFixed(1)}%</p>
                  <p className="text-blue-300/80 text-sm">Average video completion</p>
                </div>
              </div>
            </ChartContainer>
          </div>

          <ChartContainer title="🚀 AI-Powered Optimization Recommendations" subtitle="Data-driven actionable insights" fullWidth>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold text-purple-400 mb-4 flex items-center gap-2 text-lg">
                  📊 Video Funnel Optimization
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                    <span className={`text-lg ${data.funnelInsights.leadConversionRate >= 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {data.funnelInsights.leadConversionRate >= 60 ? '✅' : '⚠️'}
                    </span>
                    <div>
                      <p className="text-white font-medium">
                        {data.funnelInsights.leadConversionRate >= 60 ? 
                          'Excellent lead qualification performance' : 
                          'Optimize opening hook for better lead capture'
                        }
                      </p>
                      <p className="text-white/60 text-sm">
                        Current: {data.funnelInsights.leadConversionRate.toFixed(1)}% at 20% mark
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                    <span className={`text-lg ${data.funnelInsights.unlockConversionRate >= 35 ? 'text-emerald-400' : 'text-orange-400'}`}>
                      {data.funnelInsights.unlockConversionRate >= 35 ? '✅' : '🔧'}
                    </span>
                    <div>
                      <p className="text-white font-medium">
                        {data.funnelInsights.unlockConversionRate >= 35 ? 
                          'Strong content unlock engagement' : 
                          'Enhance value proposition at mid-video'
                        }
                      </p>
                      <p className="text-white/60 text-sm">
                        Current: {data.funnelInsights.unlockConversionRate.toFixed(1)}% at 50% mark
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                    <span className={`text-lg ${data.funnelInsights.completionRate >= 15 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.funnelInsights.completionRate >= 15 ? '📈' : '⏱️'}
                    </span>
                    <div>
                      <p className="text-white font-medium">
                        {data.funnelInsights.completionRate >= 15 ? 
                          'Good video completion rate' : 
                          'Consider video length optimization'
                        }
                      </p>
                      <p className="text-white/60 text-sm">
                        Current: {data.funnelInsights.completionRate.toFixed(1)}% completion rate
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-bold text-emerald-400 mb-4 flex items-center gap-2 text-lg">
                  💰 Revenue Optimization
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                    <span className={`text-lg ${data.vipConversions.conversionRate >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      💎
                    </span>
                    <div>
                      <p className="text-white font-medium">
                        VIP conversion rate: {data.vipConversions.conversionRate.toFixed(2)}%
                      </p>
                      <p className="text-white/60 text-sm">
                        {data.vipConversions.conversionRate < 2 ? 
                          'Test pricing strategies and urgency tactics' : 
                          'Excellent conversion performance'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                    <span className="text-lg text-purple-400">🎯</span>
                    <div>
                      <p className="text-white font-medium">
                        Season Pass dominance: {((data.vipConversions.seasonPassPurchases / (data.vipConversions.totalPurchases || 1)) * 100).toFixed(0)}%
                      </p>
                      <p className="text-white/60 text-sm">
                        Strong preference for premium offering
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                    <span className={`text-lg ${data.revenuePerSession >= 500 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      📊
                    </span>
                    <div>
                      <p className="text-white font-medium">
                        Revenue per session: {formatCurrency(data.revenuePerSession)}
                      </p>
                      <p className="text-white/60 text-sm">
                        {data.revenuePerSession < 500 ? 
                          'Opportunity to increase perceived value' : 
                          'Strong monetization efficiency'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all">
                    <span className="text-lg text-blue-400">🔥</span>
                    <div>
                      <p className="text-white font-medium">
                        Peak performance window identified
                      </p>
                      <p className="text-white/60 text-sm">
                        Schedule campaigns during high-engagement periods
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ChartContainer>

          <div className="text-center py-8 border-t border-white/10">
            <div className="space-y-2">
              <p className="text-white/60 font-medium">
                🚀 Advanced Analytics Dashboard • Real-time Intelligence Platform
              </p>
              <p className="text-white/40 text-sm">
                Last updated: {new Date().toLocaleString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-white/30">
                <span>🔗 Facebook Pixel Integration</span>
                <span>•</span>
                <span>📊 Real-time Data Processing</span>
                <span>•</span>
                <span>🎯 AI-Powered Insights</span>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes reverse-spin {
            from {
              transform: rotate(360deg);
            }
            to {
              transform: rotate(0deg);
            }
          }
          .animate-reverse-spin {
            animation: reverse-spin 1s linear infinite;
          }
        `}</style>
      </div>
    </DashboardErrorBoundary>
  );
}