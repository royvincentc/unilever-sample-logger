import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import OfflineBanner from '../ui/OfflineBanner';
import ReportIssueModal from '../ui/ReportIssueModal';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
  queueCount: number;
}

export default function Layout({ children, onLogout, queueCount }: LayoutProps) {
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen gradient-mesh">
      <OfflineBanner visible={!isOnline} />
      <Sidebar onLogout={onLogout} queueCount={queueCount} />
      <BottomNav queueCount={queueCount} />

      {/* Main content area */}
      <main className="lg:ml-64 pb-24 lg:pb-8 min-h-screen">
        {children}
      </main>

      {/* Floating Issue Report Button & Modal */}
      <ReportIssueModal />
    </div>
  );
}
