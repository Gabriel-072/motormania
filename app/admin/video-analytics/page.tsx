'use client';

import { useEffect, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AnalyticsData {
  totalSessions: number;
  funnel: Array<{
    percentage: number;
    sessions: number;
    conversionRate: number;
  }>;
  dailyStats: Array<{
    date: string;
    views: number;
  }>;
  dropoffPoints: Array<{
    from: number;
    to: number;
    dropoff: number;
  }>;
}

export default function VideoAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/dashboard?days=${days}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg">Failed to load analytics</p>
          <button 
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const funnelChart = {
    labels: data.funnel.map(f => `${f.percentage}%`),
    datasets: [{
      label: 'Usuarios Restantes',
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
      label: 'Tasa de Conversión (%)',
      data: data.funnel.map(f => f.conversionRate),
      backgroundColor: data.funnel.map((_, index) => {
        const colors = [
          'rgba(34, 197, 94, 0.8)',
          'rgba(245, 158, 11, 0.8)', 
          'rgba(239, 68, 68, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(6, 182, 212, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(139, 69, 19, 0.8)',
          'rgba(75, 85, 99, 0.8)',
          'rgba(16, 185, 129, 0.8)'
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
      return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    }),
    datasets: [{
      label: 'Reproducciones Diarias',
      data: data.dailyStats.map(d => d.views),
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointBackgroundColor: 'rgba(59, 130, 246, 1)',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#e5e7eb',
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f3f4f6',
        bodyColor: '#e5e7eb',
        borderColor: 'rgba(245, 158, 11, 0.5)',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af', font: { size: 11 } },
        grid: { color: 'rgba(75, 85, 99, 0.3)' }
      },
      y: {
        ticks: { color: '#9ca3af', font: { size: 11 } },
        grid: { color: 'rgba(75, 85, 99, 0.3)' }
      }
    }
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 50) return 'text-green-400';
    if (rate >= 30) return 'text-amber-400';
    if (rate >= 15) return 'text-orange-400';
    return 'text-red-400';
  };

  const getCompletionIcon = (rate: number) => {
    if (rate >= 50) return '🎯';
    if (rate >= 30) return '📈';
    if (rate >= 15) return '⚠️';
    return '🔻';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                VSL Video Analytics
              </h1>
              <p className="mt-1 text-gray-400">Análisis de engagement del video de ventas</p>
            </div>
            
            <div className="mt-4 sm:mt-0">
              <select 
                value={days} 
                onChange={(e) => setDays(Number(e.target.value))}
                className="bg-gray-700 border border-gray-600 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value={1}>Últimas 24 horas</option>
                <option value={7}>Últimos 7 días</option>
                <option value={30}>Últimos 30 días</option>
                <option value={90}>Últimos 90 días</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total de Sesiones</p>
                <p className="text-3xl font-bold text-blue-400">{data.totalSessions.toLocaleString()}</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">20% Completado (Leads)</p>
                <p className={`text-3xl font-bold ${getCompletionColor(data.funnel.find(f => f.percentage === 20)?.conversionRate || 0)}`}>
                  {data.funnel.find(f => f.percentage === 20)?.conversionRate.toFixed(1) || 0}%
                </p>
              </div>
              <div className="text-4xl">{getCompletionIcon(data.funnel.find(f => f.percentage === 20)?.conversionRate || 0)}</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">50% Completado</p>
                <p className={`text-3xl font-bold ${getCompletionColor(data.funnel.find(f => f.percentage === 50)?.conversionRate || 0)}`}>
                  {data.funnel.find(f => f.percentage === 50)?.conversionRate.toFixed(1) || 0}%
                </p>
              </div>
              <div className="text-4xl">{getCompletionIcon(data.funnel.find(f => f.percentage === 50)?.conversionRate || 0)}</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 hover:border-gray-600 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Video Completo</p>
                <p className={`text-3xl font-bold ${getCompletionColor(data.funnel.find(f => f.percentage === 100)?.conversionRate || 0)}`}>
                  {data.funnel.find(f => f.percentage === 100)?.conversionRate.toFixed(1) || 0}%
                </p>
              </div>
              <div className="text-4xl">{getCompletionIcon(data.funnel.find(f => f.percentage === 100)?.conversionRate || 0)}</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Funnel Chart */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-gray-100">Embudo de Retención</h2>
            <div className="h-80">
              <Line data={funnelChart} options={chartOptions} />
            </div>
          </div>
          
          {/* Conversion Rates */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700">
            <h2 className="text-xl font-bold mb-4 text-gray-100">Tasas de Conversión</h2>
            <div className="h-80">
              <Bar data={conversionChart} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Daily Views */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700 mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-100">Reproducciones Diarias</h2>
          <div className="h-80">
            <Line data={dailyChart} options={chartOptions} />
          </div>
        </div>

        {/* Dropoff Analysis */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-6 rounded-xl border border-gray-700">
          <h2 className="text-xl font-bold mb-6 text-gray-100">Puntos Críticos de Abandono</h2>
          
          {data.dropoffPoints.length > 0 ? (
            <div className="space-y-3">
              {data.dropoffPoints
                .sort((a, b) => b.dropoff - a.dropoff)
                .slice(0, 5)
                .map((point, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? 'bg-red-500/20 text-red-400' :
                      index === 1 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {point.from}% → {point.to}%
                      </p>
                      <p className="text-gray-400 text-sm">
                        Punto de abandono crítico
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-400">
                      -{point.dropoff}
                    </p>
                    <p className="text-gray-400 text-sm">usuarios perdidos</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">📊</div>
              <p>No hay suficientes datos para analizar abandono</p>
            </div>
          )}
        </div>

        {/* Quick Insights */}
        <div className="mt-8 bg-gradient-to-br from-amber-900/20 to-orange-900/20 p-6 rounded-xl border border-amber-500/30">
          <h2 className="text-xl font-bold mb-4 text-amber-400">💡 Insights Rápidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-300">
                <span className="text-amber-400 font-semibold">Engagement inicial:</span> {' '}
                {data.funnel.find(f => f.percentage === 10)?.conversionRate.toFixed(1) || 0}% 
                de usuarios ven al menos 10% del video
              </p>
            </div>
            <div>
              <p className="text-gray-300">
                <span className="text-amber-400 font-semibold">Punto de decisión:</span> {' '}
                {data.funnel.find(f => f.percentage === 20)?.conversionRate.toFixed(1) || 0}% 
                alcanzan el unlock (20%)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}