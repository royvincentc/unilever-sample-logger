import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/Layout/Layout';
import LoginPage from './components/auth/LoginPage';
import { ToastProvider } from './components/ui/Toast';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { getQueueItems } from './utils/db';
import Dashboard from './pages/Dashboard';
import NewSample from './pages/NewSample';
import SubmissionQueue from './pages/SubmissionQueue';
import SampleHistory from './pages/SampleHistory';
import Incubation from './pages/Incubation';
import Results from './pages/Results';
import Settings from './pages/Settings';

export default function App() {
  const { theme, setTheme } = useTheme();
  const { authenticated, login, pinLogin, logout } = useAuth();
  const [queueCount, setQueueCount] = useState(0);

  const refreshQueueCount = useCallback(async () => {
    const items = await getQueueItems();
    setQueueCount(items.filter(i => i.status === 'queued' || i.status === 'failed').length);
  }, []);

  useEffect(() => {
    if (authenticated) refreshQueueCount();
  }, [authenticated, refreshQueueCount]);

  // Auto-sync on reconnect
  useEffect(() => {
    const handler = () => refreshQueueCount();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [refreshQueueCount]);

  if (!authenticated) {
    return (
      <ToastProvider>
        <LoginPage onLogin={login} onPinLogin={pinLogin} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Layout onLogout={logout} queueCount={queueCount}>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Dashboard theme={theme} onSetTheme={setTheme} queueCount={queueCount} />} />
              <Route path="/new" element={<NewSample theme={theme} onSetTheme={setTheme} onQueueUpdate={refreshQueueCount} />} />
              <Route path="/queue" element={<SubmissionQueue theme={theme} onSetTheme={setTheme} onQueueUpdate={refreshQueueCount} />} />
              <Route path="/history" element={<SampleHistory theme={theme} onSetTheme={setTheme} />} />
              <Route path="/incubation" element={<Incubation theme={theme} onSetTheme={setTheme} />} />
              <Route path="/results" element={<Results theme={theme} onSetTheme={setTheme} />} />
              <Route path="/settings" element={<Settings theme={theme} onSetTheme={setTheme} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </Layout>
      </BrowserRouter>
    </ToastProvider>
  );
}
