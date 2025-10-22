import type { Metadata } from 'next';
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { ProtectedRoute } from '@/components/shared/protected-route';

export const metadata: Metadata = {
  title: 'Developer Dashboard - FrameOS',
  description: 'Manage your agents, track revenue, and view analytics',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-muted/30">
        <DashboardNav />
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
