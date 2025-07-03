'use client';

import { useEffect, useState } from 'react';
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

export default function VideoAnalyticsDashboard() {
  const [data, setData] = useState<EnhancedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analytics/dashboard?days=${days}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setData(result);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-amber-500 mx-auto mb-6"></div>
          <p className="text-gray-300 text-lg">Loading advanced analytics...</p>
          <p className="text-gray-500 text-sm mt-2">Processing {days} days of data</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <p className="text-red-400 text-xl mb-4">Error Loading Analytics</p>
          <p className="text-gray-400 mb-6">{error || 'Could not load data'}</p>
          <button 
            onClick={fetchAnalytics}
            className="px-6 py-3 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all font-semibold"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  // Chart configurations
  const funnelChart = {
    labels: data.funnel.map(f => `${f.percentage}%`),
    datasets: [{
      label: 'Active Users',
      data: data.funnel.map(f => f.sessions),
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 1)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: 'rgba(245, 158, 11, 1)',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 8,
    }]
  };

  const conversionChart = {
    labels: data.funnel.map(f => `${f.percentage}%`),
    datasets: [{
      label: 'Conversion Rate (%)',
      data: data.funnel.map(f => f.conversionRate),
      backgroundColor: data.funnel.map((_, index) => {
        const colors = [
          'rgba(34, 197, 94, 0.8)',   // Green
          'rgba(245, 158, 11, 0.8)',  // Amber  
          'rgba(239, 68, 68, 0.8)',   // Red
          'rgba(168, 85, 247, 0.8)',  // Purple
          'rgba(6, 182, 212, 0.8)',   // Cyan
          'rgba(236, 72, 153, 0.8)',  // Pink
          'rgba(234, 179, 8, 0.8)',   // Yellow
          'rgba(139, 69, 19, 0.8)',   // Brown
          'rgba(75, 85, 99, 0.8)',    // Gray
          'rgba(16, 185, 129, 0.8)'   // Emerald
        ];
        return colors[index % colors.length];
      }),
      borderRadius: 8,
      borderSkipped: false,
    }]
  };

  const dailyChart = {
    labels: data.dailyStats.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }),
    datasets: [
      {
        label: 'Sessions',
        data: data.dailyStats.map(d => d.sessions),
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
      },
      {
        label: 'Users',
        data: data.dailyStats.map(d => d.users),
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 3,
        fill: false,
        tension: 0.4,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
      }
    ]
  };

  const planDistributionChart = {
    labels: ['Season Pass', 'Race Pass'],
    datasets: [{
      data: [data.vipConversions.seasonPassPurchases, data.vipConversions.racePassPurchases],
      backgroundColor: [
        'rgba(245, 158, 11, 0.8)',
        'rgba(59, 130, 246, 0.8)'
      ],
      borderColor: [
        'rgba(245, 158, 11, 1)',
        'rgba(59, 130, 246, 1)'
      ],
      borderWidth: 2,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#e5e7eb',
          font: { size: 12, family: "'Inter', sans-serif" }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f3f4f6',
        bodyColor: '#e5e7eb',
        borderColor: 'rgba(245, 158, 11, 0.5)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
      }
    },
    scales: {
      x: {
        ticks: { 
          color: '#9ca3af', 
          font: { size: 11, family: "'Inter', sans-serif" } 
        },
        grid: { color: 'rgba(75, 85, 99, 0.3)' }
      },
      y: {
        ticks: { 
          color: '#9ca3af', 
          font: { size: 11, family: "'Inter', sans-serif" } 
        },
        grid: { color: 'rgba(75, 85, 99, 0.3)' }
      }
    }
  };

  const getMetricColor = (value: number, thresholds = { good: 50, ok: 30, poor: 15 }) => {
    if (value >= thresholds.good) return 'text-green-400';
    if (value >= thresholds.ok) return 'text-amber-400';
    if (value >= thresholds.poor) return 'text-orange-400';
    return 'text-red-400';
  };

  const getMetricIcon = (value: number, thresholds = { good: 50, ok: 30, poor: 15 }) => {
    if (value >= thresholds.good) return '🎯';
    if (value >= thresholds.ok) return '📈';
    if (value >= thresholds.poor) return '⚠️';
    return '🔻';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount / 4000); // Convert COP to USD approximation
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white font-inter">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                🎯 VIP Analytics Dashboard
              </h1>
              <p className="mt-2 text-gray-400 text-lg">
                Complete engagement and VIP conversion analysis
              </p>
              <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                <span>📊 {data.totalSessions.toLocaleString()} total sessions</span>
                <span>💎 {data.vipConversions.totalPurchases} VIP conversions</span>
                <span>💰 {formatCurrency(data.vipConversions.revenue)} in revenue</span>
              </div>
            </div>
            
            <div className="mt-6 sm:mt-0 flex flex-col gap-3">
              <select 
                value={days} 
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
              >
                <option value={1}>Last 24 hours</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button
                onClick={fetchAnalytics}
                className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-2"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {/* Total Sessions */}
          <div className="bg-gradient-to-br from-blue-800 to-blue-900 p-6 rounded-xl border border-blue-700 hover:border-blue-600 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-200">Total Sessions</p>
                <p className="text-3xl font-bold text-blue-400">{data.totalSessions.toLocaleString()}</p>
                <p className="text-xs text-blue-300 mt-1">Last {days} days</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>
          
          {/* Lead Qualification Rate (20% Video) */}
          <div className="bg-gradient-to-br from-amber-800 to-amber-900 p-6 rounded-xl border border-amber-700 hover:border-amber-600 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-200">Lead Qualification (20%)</p>
                <p className={`text-3xl font-bold ${getMetricColor(data.funnelInsights.leadConversionRate)}`}>
                  {data.funnelInsights.leadConversionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-amber-300 mt-1">Facebook Lead Events</p>
              </div>
              <div className="text-4xl">{getMetricIcon(data.funnelInsights.leadConversionRate)}</div>
            </div>
          </div>
          
          {/* Content Unlock Rate (50% Video) */}
          <div className="bg-gradient-to-br from-green-800 to-green-900 p-6 rounded-xl border border-green-700 hover:border-green-600 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-200">Content Unlock (50%)</p>
                <p className={`text-3xl font-bold ${getMetricColor(data.funnelInsights.unlockConversionRate)}`}>
                  {data.funnelInsights.unlockConversionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-green-300 mt-1">VIP offer access</p>
              </div>
              <div className="text-4xl">{getMetricIcon(data.funnelInsights.unlockConversionRate)}</div>
            </div>
          </div>
          
          {/* Video Completion Rate */}
          <div className="bg-gradient-to-br from-purple-800 to-purple-900 p-6 rounded-xl border border-purple-700 hover:border-purple-600 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-200">Video Complete (100%)</p>
                <p className={`text-3xl font-bold ${getMetricColor(data.funnelInsights.completionRate)}`}>
                  {data.funnelInsights.completionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-purple-300 mt-1">Maximum engagement</p>
              </div>
              <div className="text-4xl">{getMetricIcon(data.funnelInsights.completionRate)}</div>
            </div>
          </div>
        </div>

        {/* VIP Conversion Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {/* VIP Conversion Rate */}
          <div className="bg-gradient-to-br from-emerald-800 to-emerald-900 p-6 rounded-xl border border-emerald-700 hover:border-emerald-600 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-200">VIP Conversion</p>
                <p className="text-3xl font-bold text-emerald-400">
                  {data.vipConversions.conversionRate.toFixed(2)}%
                </p>
                <p className="text-xs text-emerald-300 mt-1">{data.vipConversions.totalPurchases} purchases</p>
              </div>
              <div className="text-4xl">💎</div>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-pink-800 to-pink-900 p-6 rounded-xl border border-pink-700 hover:border-pink-600 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-pink-200">Total Revenue</p>
                <p className="text-3xl font-bold text-pink-400">
                  {formatCurrency(data.vipConversions.revenue)}
                </p>
                <p className="text-xs text-pink-300 mt-1">Last {days} days</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          {/* Revenue per Session */}
          <div className="bg-gradient-to-br from-indigo-800 to-indigo-900 p-6 rounded-xl border border-indigo-700 hover:border-indigo-600 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-200">Value per Session</p>
                <p className="text-3xl font-bold text-indigo-400">
                  {formatCurrency(data.revenuePerSession)}
                </p>
                <p className="text-xs text-indigo-300 mt-1">Average revenue</p>
              </div>
              <div className="text-4xl">📈</div>
            </div>
          </div>

          {/* Average Order Value */}
          <div className="bg-gradient-to-br from-orange-800 to-orange-900 p-6 rounded-xl border border-orange-700 hover:border-orange-600 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-200">Average Order Value</p>
                <p className="text-3xl font-bold text-orange-400">
                  {formatCurrency(data.vipConversions.averageOrderValue)}
                </p>
                <p className="text-xs text-orange-300 mt-1">AOV per purchase</p>
              </div>
              <div className="text-4xl">🎯</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Funnel Retention Chart */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-100">📊 Retention Funnel</h2>
              <div className="text-sm text-gray-400">
                Facebook event correlation
              </div>
            </div>
            <div className="h-80">
              <Line data={funnelChart} options={chartOptions} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                <p className="text-amber-400 font-semibold">20% = Lead Event</p>
                <p className="text-gray-300">Auto qualification</p>
              </div>
              <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                <p className="text-green-400 font-semibold">50% = ViewContent</p>
                <p className="text-gray-300">Content unlock</p>
              </div>
            </div>
          </div>
          
          {/* Conversion Rates Bar Chart */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold mb-6 text-gray-100">📈 Conversion Rates by Milestone</h2>
            <div className="h-80">
              <Bar data={conversionChart} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Daily Performance and Plan Distribution */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          {/* Daily Performance Chart */}
          <div className="xl:col-span-2 bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold mb-6 text-gray-100">📅 Daily Performance</h2>
            <div className="h-80">
              <Line data={dailyChart} options={chartOptions} />
            </div>
          </div>
          
          {/* Plan Distribution */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-xl font-bold mb-6 text-gray-100">🎯 Plan Distribution</h2>
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
                        color: '#e5e7eb',
                        font: { size: 12 }
                      }
                    }
                  }
                }} 
              />
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-amber-400">Season Pass</span>
                <span className="font-bold">{data.vipConversions.seasonPassPurchases}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-400">Race Pass</span>
                <span className="font-bold">{data.vipConversions.racePassPurchases}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Event Tracking Stats */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 shadow-lg mb-8">
          <h2 className="text-xl font-bold mb-6 text-gray-100">🎯 VIP Event Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">{data.eventStats.leadQualifications}</div>
              <p className="text-sm text-gray-400 mt-1">Qualified Leads</p>
              <p className="text-xs text-amber-300">20% video watched</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{data.eventStats.contentUnlocks}</div>
              <p className="text-sm text-gray-400 mt-1">Content Unlocked</p>
              <p className="text-xs text-green-300">50% video watched</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">{data.eventStats.planViews}</div>
              <p className="text-sm text-gray-400 mt-1">Plan Views</p>
              <p className="text-xs text-blue-300">Plan interest</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{data.eventStats.checkoutInitiations}</div>
              <p className="text-sm text-gray-400 mt-1">Checkouts Started</p>
              <p className="text-xs text-purple-300">Purchase intent</p>
            </div>
          </div>
        </div>

        {/* Critical Drop-off Analysis */}
        <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 p-6 rounded-xl border border-red-500/30 shadow-lg mb-8">
          <h2 className="text-xl font-bold mb-6 text-red-400">⚠️ Critical Drop-off Point Analysis</h2>
          
          {data.dropoffPoints.length > 0 ? (
            <div className="space-y-4">
              {data.dropoffPoints
                .sort((a, b) => b.dropoffRate - a.dropoffRate)
                .slice(0, 5)
                .map((point, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-red-500/20 text-red-400' :
                      index === 1 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      #{index + 1}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        From {point.from}% to {point.to}%
                      </p>
                      <p className="text-gray-400 text-sm">
                        Drop-off rate: {point.dropoffRate.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-400">
                      -{point.dropoff}
                    </p>
                    <p className="text-gray-400 text-sm">users lost</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">📊</div>
              <p>Not enough data to analyze drop-off</p>
            </div>
          )}
        </div>

        {/* Performance Insights */}
        <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 p-6 rounded-xl border border-amber-500/30 shadow-lg mb-8">
          <h2 className="text-xl font-bold mb-6 text-amber-400">💡 Performance Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-700/30 p-4 rounded-lg">
              <h3 className="font-semibold text-amber-400 mb-2">🏆 Best Day</h3>
              {data.insights.bestPerformingDay ? (
                <div>
                  <p className="text-white">{new Date(data.insights.bestPerformingDay.date).toLocaleDateString('en-US')}</p>
                  <p className="text-gray-300 text-sm">{data.insights.bestPerformingDay.sessions} sessions</p>
                </div>
              ) : (
                <p className="text-gray-400">Insufficient data</p>
              )}
            </div>
            
            <div className="bg-gray-700/30 p-4 rounded-lg">
              <h3 className="font-semibold text-red-400 mb-2">📉 Biggest Drop-off</h3>
              {data.insights.worstDropoffPoint ? (
                <div>
                  <p className="text-white">{data.insights.worstDropoffPoint.from}% → {data.insights.worstDropoffPoint.to}%</p>
                  <p className="text-gray-300 text-sm">{data.insights.worstDropoffPoint.dropoffRate.toFixed(1)}% drop-off</p>
                </div>
              ) : (
                <p className="text-gray-400">No drop-off data</p>
              )}
            </div>
            
            <div className="bg-gray-700/30 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-400 mb-2">⏱️ Average Engagement</h3>
              <p className="text-white">{data.insights.averageSessionLength.toFixed(1)}%</p>
              <p className="text-gray-300 text-sm">Average video progress</p>
            </div>
          </div>
        </div>

        {/* Quick Action Items */}
        <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 p-6 rounded-xl border border-blue-500/30 shadow-lg">
          <h2 className="text-xl font-bold mb-6 text-blue-400">🚀 Optimization Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-blue-400 mb-3">📊 Video Funnel</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span className="text-gray-300">
                    {data.funnelInsights.leadConversionRate >= 20 ? 
                      'Excellent lead qualification rate' : 
                      'Optimize first 20% of video for more leads'
                    }
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">⚠</span>
                  <span className="text-gray-300">
                    {data.funnelInsights.unlockConversionRate >= 35 ? 
                      'Good content unlock ratio' : 
                      'Improve hook at minute 2-3 of video'
                    }
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">📈</span>
                  <span className="text-gray-300">
                    Completion rate: {data.funnelInsights.completionRate.toFixed(1)}%
                    {data.funnelInsights.completionRate < 15 ? ' - Consider shortening video' : ''}
                  </span>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-green-400 mb-3">💰 VIP Conversions</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">💎</span>
                  <span className="text-gray-300">
                    VIP conversion: {data.vipConversions.conversionRate.toFixed(2)}%
                    {data.vipConversions.conversionRate < 2 ? ' - Optimize offer and pricing' : ' - Good performance'}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-400">🎯</span>
                  <span className="text-gray-300">
                    Season Pass represents {((data.vipConversions.seasonPassPurchases / (data.vipConversions.totalPurchases || 1)) * 100).toFixed(1)}% of sales
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">📊</span>
                  <span className="text-gray-300">
                    Value per session: {formatCurrency(data.revenuePerSession)}
                    {data.revenuePerSession < 125 ? ' - Increase perceived value' : ''}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8 border-t border-gray-700 mt-8">
          <p className="text-gray-400 text-sm">
            📊 Analytics Dashboard • Last updated: {new Date().toLocaleString('en-US')}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Data correlated with Facebook Pixel events for ad optimization
          </p>
        </div>
      </div>
    </div>
  );
}