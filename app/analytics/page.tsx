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
  FaCreditCard, FaPaypal, FaCalendarAlt, FaTrophy
} from 'react-icons/fa';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';

interface AnalyticsData {
  period: number;
  revenue: Array<{
    date: string;
    revenue: number;
    transactions: number;
    avg_bet: number;
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
  totals: {
    total_users: number;
    total_transactions: number;
    total_revenue: number;
    total_picks: number;
  };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
const PERIODS = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' }
];

export default function AnalyticsPage() {
  const { user, isLoaded } = useUser();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'gamot62.72') {
      setIsAuthenticated(true);
    } else {
      toast.error('Contraseña incorrecta');
      setPassword('');
    }
  };

  const fetchAnalytics = async (selectedPeriod: string) => {
    try {
      setLoading(true);
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
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

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
    return new Date(dateStr).toLocaleDateString('es-CO', {
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-amber-400">📊 Analytics MotorManía GO</h1>
            <p className="text-gray-400 mt-1">Dashboard de métricas en tiempo real</p>
          </div>
          
          {/* Period Selector */}
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  period === p.value 
                    ? 'bg-amber-500 text-black' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-green-800/50 to-green-900/50 p-6 rounded-xl border border-green-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-sm font-medium">Ingresos Totales</p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(data.totals.total_revenue)}
                    </p>
                  </div>
                  <FaDollarSign className="text-green-400 text-2xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-blue-800/50 to-blue-900/50 p-6 rounded-xl border border-blue-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 text-sm font-medium">Usuarios Nuevos</p>
                    <p className="text-2xl font-bold text-white">{data.totals.total_users.toLocaleString()}</p>
                  </div>
                  <FaUsers className="text-blue-400 text-2xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-purple-800/50 to-purple-900/50 p-6 rounded-xl border border-purple-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-400 text-sm font-medium">Transacciones</p>
                    <p className="text-2xl font-bold text-white">{data.totals.total_transactions.toLocaleString()}</p>
                  </div>
                  <FaChartLine className="text-purple-400 text-2xl" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-amber-800/50 to-amber-900/50 p-6 rounded-xl border border-amber-700/50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-400 text-sm font-medium">Total Picks</p>
                    <p className="text-2xl font-bold text-white">{data.totals.total_picks.toLocaleString()}</p>
                  </div>
                  <FaGamepad className="text-amber-400 text-2xl" />
                </div>
              </motion.div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.revenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      tickFormatter={formatDate}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
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
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 4 }}
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
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.users}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      tickFormatter={formatDate}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} />
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

              {/* Traffic Sources */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
              >
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  🌍 Fuentes de Tráfico
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
              {/* Popular Campaigns */}
              {data.trafficCampaigns.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gray-800/50 p-6 rounded-xl border border-gray-700/50"
                >
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    🎯 Campañas Populares
                  </h3>
                  <div className="space-y-3">
                    {data.trafficCampaigns.slice(0, 6).map((campaign, index) => (
                      <div key={campaign.campaign} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            COLORS[index % COLORS.length]
                          }`} style={{ backgroundColor: COLORS[index % COLORS.length] }}>
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