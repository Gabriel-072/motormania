// ============================================================================
// FILE 5: Complete Analytics Page Component
// /app/analytics/page.tsx - Main page that renders the dashboard
// ============================================================================

import { Metadata } from 'next';
import VideoAnalyticsDashboard from '@/components/VideoAnalyticsDashboard';

export const metadata: Metadata = {
  title: 'VIP Analytics Dashboard | MotorManía',
  description: 'Dashboard completo de analytics para el funnel VIP con correlación de eventos de Facebook',
};

export default function AnalyticsPage() {
  return <VideoAnalyticsDashboard />;
}