'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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

  if (loading) return <div className="p-8">Loading analytics...</div>;
  if (!data) return <div className="p-8">Failed to load analytics</div>;

  const funnelChart = {
    labels: data.funnel.map(f => `${f.percentage}%`),
    datasets: [{
      label: 'Sessions Remaining',
      data: data.funnel.map(f => f.sessions),
      backgroundColor: 'rgba(245, 158, 11, 0.6)',
      borderColor: 'rgba(245, 158, 11, 1)',
      borderWidth: 2,
      fill: true
    }]
  };

  const dailyChart = {
    labels: data.dailyStats.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [{
      label: 'Daily Video Starts',
      data: data.dailyStats.map(d => d.views),
      backgroundColor: 'rgba(59, 130, 246, 0.6)',
      borderColor: 'rgba(59, 130, 246, 1)',
      borderWidth: 2
    }]
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">VSL Video Analytics</h1>
      
      {/* Controls */}
      <div className="mb-6">
        <select 
          value={days} 
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-4 py-2 border rounded-lg"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-600">Total Sessions</h3>
          <p className="text-3xl font-bold text-blue-600">{data.totalSessions}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-600">20% Completion</h3>
          <p className="text-3xl font-bold text-amber-600">
            {data.funnel.find(f => f.percentage === 20)?.conversionRate.toFixed(1) || 0}%
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-600">50% Completion</h3>
          <p className="text-3xl font-bold text-green-600">
            {data.funnel.find(f => f.percentage === 50)?.conversionRate.toFixed(1) || 0}%
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-600">Full Completion</h3>
          <p className="text-3xl font-bold text-purple-600">
            {data.funnel.find(f => f.percentage === 100)?.conversionRate.toFixed(1) || 0}%
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Video Completion Funnel</h2>
          <Line data={funnelChart} />
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Daily Video Starts</h2>
          <Line data={dailyChart} />
        </div>
      </div>

      {/* Dropoff Analysis */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Biggest Dropoff Points</h2>
        <div className="space-y-2">
          {data.dropoffPoints
            .sort((a, b) => b.dropoff - a.dropoff)
            .slice(0, 5)
            .map((point, index) => (
            <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span>{point.from}% → {point.to}%</span>
              <span className="font-bold text-red-600">-{point.dropoff} sessions</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}