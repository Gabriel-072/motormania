// 📁 app/analytics/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { 
  FaUsers, FaDollarSign, FaChartLine, FaGamepad,
  FaCreditCard, FaPaypal, FaCalendarAlt, FaTrophy, FaBullseye, FaPercentage,
  FaSync, FaClock
} from 'react-icons/fa';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';

interface AnalyticsData {
  period: string; // Changed from number to string
  period_label: string;
  last_updated: string;
  revenue: Array<{
    date: string;
    revenue: number;
    transactions: number;
    avg_bet: number;
  }>;
  // 🎯 NEW: AOV trending data
  aov: Array<{
    date: string;
    aov: number;
    transactions: number;
    revenue: number;
  }>;
  users: Array<{
    date: string;
    new_users: number;
  }>;
  paymentMethods: Array<{
    payment_method: string;
    count: number;
    revenue: number;
  }>;
  popularDrivers: Array<{
    driver: string;
    pick_count: number;
  }>;
  trafficSources: Array<{
    source: string;
    count: number;
  }>;
  trafficMediums: Array<{
    medium: string;
    count: number;
  }>;
  trafficCampaigns: Array<{
    campaign: string;
    count: number;
  }>;
  utmRevenue: Array<{
    source_campaign: string;
    source: string;
    campaign: string;
    revenue: number;
    purchases: number;
    avg_purchase: number;
  }>;
  utmSources: Array<{
    source: string;
    revenue: number;
    purchases: number;
    avg_purchase: number;
  }>;
  utmCampaigns: Array<{
    campaign: string;
    source: string;
    revenue: number;
    purchases: number;
    avg_purchase: number;
  }>;
  // 🎯 NEW: Conversion rates data
  utmConversionRates: Array<{
    source: string;
    visits: number;
    purchases: number;
    conversion_rate: number;
    revenue: number;
    revenue_per_visit: number;
  }>;
  totals: {
    total_users: number;
    total_transactions: number;
    total_revenue: number;
    total_picks: number;
    total_visits: number;
    attributed_revenue: number;
    attribution_rate: number;
    attributed_purchases: number;
    // 🎯 NEW: AOV and Conversion metrics
    aov: number;
    overall_conversion_rate: number;
    revenue_per_visit: number;
  };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];
const PERIODS = [
  { value: '4h', label: '4 horas' },
  { value: '24h', label: '24 horas' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' }
];

export default function AnalyticsPage() {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('24h'); // Changed default to 24h
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'gamot62.72') {
      setIsAuthenticated(true);
    } else {
      toast.error('Contraseña incorrecta');
      setPassword('');
    }
  };

  const fetchAnalytics = async (selectedPeriod: string, isAutoRefresh = false) => {
    try {
      if (isAutoRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const response = await fetch(`/api/analytics?period=${selectedPeriod}`);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('No tienes permisos para ver esta página');
        }
        throw new Error('Error cargando datos');
      }

      const analyticsData = await response.json();
      setData(analyticsData);
      setLastUpdated(analyticsData.last_updated);
    } catch (err: any) {
      setError(err.message);
      if (!isAutoRefresh) {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!isLoaded || !isAuthenticated || !autoRefresh) return;

    const refreshInterval = setInterval(() => {
      fetchAnalytics(period, true); // Mark as auto-refresh
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [isLoaded, isAuthenticated, period, autoRefresh]);

  useEffect(() => {
    if (isLoaded && isAuthenticated) {
      fetchAnalytics(period);
    }
  }, [isLoaded, period, isAuthenticated]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    
    // For hourly data, show time
    if (period === '4h' || period === '24h') {
      return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // For daily data, show date
    return date.toLocaleDateString('es-CO', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-lg">Cargando...</div>
      </div>
    );
  }

  // Password protection
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 p-8 rounded-xl border border-gray-700/50 max-w-md w-full mx-4"
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-amber-400 mb-2">🔒 Analytics Restringido</h1>
            <p className="text-gray-400">Ingresa la contraseña para acceder</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña..."
              className="w-full px-4 py-3 bg-gray-700/60 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors"
            >
              Acceder
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-lg">Cargando analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-amber-400">📊 Analytics MotorManía GO</h1>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-gray-400">Dashboard de métricas en tiempo real</p>
              {lastUpdated && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                  Actualizado: {new Date(lastUpdated).toLocaleTimeString('es-CO')}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            {/* Auto-refresh toggle */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-700 text-green-500 focus:ring-green-500"
                />
                Auto-refresh (30s)
              </label>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2 flex-wrap">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
                    period === p.value 
                      ? 'bg-amber-500 text-black' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Manual refresh button */}
            <button
              onClick={() => fetchAnalytics(period)}
              disabled={loading}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
            >
              {loading ? '⟳' : '🔄'}
            </button>
          </div>
        </div>

        {data && (
          <>
            {/* KPI Cards - Enhanced with AOV and Conversion */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-green-800/50 to-green-900/50 p-4 rounded-xl border border-green-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-xs font-medium">Ingresos Totales</p>
                    <p className="text-xl font-bold text-white">
                      {formatCurrency(data.totals.total_revenue)}
                    </p>
                  </div>
                  <FaDollarSign className="text-green-400 text-xl" />
                </div>
              </motion.div>

              {/* 🎯 NEW: AOV Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-emerald-800/50 to-emerald-900/50 p-4 rounded-xl border border-emerald-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-400 text-xs font-medium">AOV Promedio</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(data.totals.aov)}</p>
                  </div>
                  <FaChartLine className="text-emerald-400 text-xl" />
                </div>
              </motion.div>

              {/* 🎯 NEW: Conversion Rate Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-orange-800/50 to-orange-900/50 p-4 rounded-xl border border-orange-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-400 text-xs font-medium">Conversión</p>
                    <p className="text-xl font-bold text-white">{data.totals.overall_conversion_rate}%</p>
                  </div>
                  <FaPercentage className="text-orange-400 text-xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 p-4 rounded-xl border border-blue-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 text-xs font-medium">Usuarios Nuevos</p>
                    <p className="text-xl font-bold text-white">{data.totals.total_users.toLocaleString()}</p>
                  </div>
                  <FaUsers className="text-blue-400 text-xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-purple-800/50 to-purple-900/50 p-4 rounded-xl border border-purple-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-400 text-xs font-medium">Transacciones</p>
                    <p className="text-xl font-bold text-white">{data.totals.total_transactions.toLocaleString()}</p>
                  </div>
                  <FaChartLine className="text-purple-400 text-xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-cyan-800/50 to-cyan-900/50 p-4 rounded-xl border border-cyan-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-cyan-400 text-xs font-medium">Atribución UTM</p>
                    <p className="text-xl font-bold text-white">{data.totals.attribution_rate}%</p>
                    <p className="text-xs text-cyan-300">{formatCurrency(data.totals.attributed_revenue)}</p>
                  </div>
                  <FaBullseye className="text-cyan-400 text-xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-gradient-to-br from-amber-800/50 to-amber-900/50 p-4 rounded-xl border border-amber-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-400 text-xs font-medium">Total Picks</p>
                    <p className="text-xl font-bold text-white">{data.totals.total_picks.toLocaleString()}</p>
                  </div>
                  <FaGamepad className="text-amber-400 text-xl" />
                </div>
              </motion.div>
            </div>

            {/* Charts Row 1 - Revenue, AOV, Users */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Revenue Chart */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FaDollarSign className="text-green-400" />
                  Ingresos Diarios
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.revenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickFormatter={formatDate}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
                      labelFormatter={(label: string) => formatDate(label)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={{ fill: '#10b981', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* 🎯 NEW: AOV Trending Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FaChartLine className="text-emerald-400" />
                  AOV Trending
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.aov}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickFormatter={formatDate}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'AOV']}
                      labelFormatter={(label: string) => formatDate(label)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="aov" 
                      stroke="#10d9b4" 
                      strokeWidth={2}
                      dot={{ fill: '#10d9b4', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Users Chart */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FaUsers className="text-blue-400" />
                  Registros Diarios
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.users}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickFormatter={formatDate}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [value, 'Usuarios']}
                      labelFormatter={(label: string) => formatDate(label)}
                    />
                    <Bar dataKey="new_users" fill="#3b82f6" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            {/* 🎯 NEW: Conversion Rates Table */}
            <div className="mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🎯 Tasas de Conversión por Fuente UTM
                  {data.period === '4h' || data.period === '24h' ? (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                      REAL-TIME
                    </span>
                  ) : null}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-300 font-medium">Fuente</th>
                        <th className="text-right py-3 px-4 text-gray-300 font-medium">Visitas</th>
                        <th className="text-right py-3 px-4 text-gray-300 font-medium">Compras</th>
                        <th className="text-right py-3 px-4 text-gray-300 font-medium">Conv. %</th>
                        <th className="text-right py-3 px-4 text-gray-300 font-medium">Ingresos</th>
                        <th className="text-right py-3 px-4 text-gray-300 font-medium">Rev/Visita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.utmConversionRates.slice(0, 10).map((source, index) => (
                        <tr key={source.source} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full`} 
                                   style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                              <span className="text-white font-medium">{source.source}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-300">{source.visits.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right text-white font-semibold">{source.purchases}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-bold ${
                              source.conversion_rate >= 5 ? 'text-green-400' :
                              source.conversion_rate >= 2 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {source.conversion_rate}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-green-400 font-semibold">
                            {formatCurrency(source.revenue)}
                          </td>
                          <td className="py-3 px-4 text-right text-cyan-400 font-medium">
                            {formatCurrency(source.revenue_per_visit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>

            {/* 🎯 NEW: UTM Revenue Attribution Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* UTM Sources Revenue */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FaBullseye className="text-cyan-400" />
                  Ingresos por Fuente UTM
                </h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {data.utmSources.slice(0, 8).map((source, index) => (
                    <div key={source.source} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white`} 
                             style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                          {index + 1}
                        </div>
                        <span className="text-white font-medium truncate">{source.source}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{formatCurrency(source.revenue)}</div>
                        <div className="text-gray-400 text-xs">{source.purchases} compras</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* UTM Campaigns Revenue */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🎯 Campañas con Mayor Retorno
                </h3>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {data.utmCampaigns.slice(0, 8).map((campaign, index) => (
                    <div key={campaign.campaign} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white`}
                             style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                          {index + 1}
                        </div>
                        <div>
                          <span className="text-white font-medium truncate block">{campaign.campaign}</span>
                          <span className="text-gray-400 text-xs">{campaign.source}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-semibold">{formatCurrency(campaign.revenue)}</div>
                        <div className="text-gray-400 text-xs">{campaign.purchases} compras</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Payment Methods */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FaCreditCard className="text-amber-400" />
                  Métodos de Pago
                </h3>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.paymentMethods}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="revenue"
                        label={(entry: any) => 
                          `${entry.payment_method} ${(entry.percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {data.paymentMethods.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [formatCurrency(value), 'Ingresos']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Traffic Sources (Visits) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🌍 Fuentes de Tráfico (Visitas)
                </h3>
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.trafficSources}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="count"
                        label={(entry: any) => 
                          `${entry.source} ${(entry.percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {data.trafficSources.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => [value, 'Visitantes']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            {/* Charts Row 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Popular Campaigns (Traffic) */}
              {data.trafficCampaigns.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    🎯 Campañas Populares (Tráfico)
                  </h3>
                  <div className="space-y-3">
                    {data.trafficCampaigns.slice(0, 6).map((campaign, index) => (
                      <div key={campaign.campaign} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold`} 
                               style={{ backgroundColor: COLORS[index % COLORS.length], color: 'white' }}>
                            {index + 1}
                          </div>
                          <span className="text-white font-medium truncate">{campaign.campaign}</span>
                        </div>
                        <span className="text-gray-400 text-sm">{campaign.count} visitantes</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              
              {/* Popular Drivers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FaTrophy className="text-yellow-400" />
                  Pilotos Más Populares
                </h3>
                <div className="space-y-3">
                  {data.popularDrivers.slice(0, 8).map((driver, index) => (
                    <div key={driver.driver} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-black' :
                          index === 1 ? 'bg-gray-400 text-black' :
                          index === 2 ? 'bg-amber-600 text-white' :
                          'bg-gray-600 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="text-white font-medium truncate">{driver.driver}</span>
                      </div>
                      <span className="text-gray-400 text-sm">{driver.pick_count} picks</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}