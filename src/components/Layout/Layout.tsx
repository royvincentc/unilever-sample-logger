import { useState } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import OfflineBanner from '../ui/OfflineBanner';
import ReportIssueModal from '../ui/ReportIssueModal';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { AnimatePresence, motion } from 'framer-motion';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
  queueCount: number;
}

export default function Layout({ children, onLogout, queueCount }: LayoutProps) {
  const isOnline = useOnlineStatus();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen gradient-mesh">
      <OfflineBanner visible={!isOnline} />
      
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <Sidebar 
        onLogout={onLogout} 
        queueCount={queueCount} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <BottomNav 
        queueCount={queueCount} 
        onMenuClick={() => setIsMobileMenuOpen(true)}
      />

      {/* Main content area */}
      <main className={`transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[280px]'} pb-28 lg:pb-8 min-h-screen`}>
        {children}
      </main>

      {/* Floating Issue Report Button & Modal */}
      <ReportIssueModal />
    </div>
  );
}
