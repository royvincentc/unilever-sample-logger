import { useState, useEffect, useCallback } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './utils/firebase';
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
  const [firebaseReady, setFirebaseReady] = useState(false);

  const refreshQueueCount = useCallback(async () => {
    const items = await getQueueItems();
    setQueueCount(items.filter(i => i.status === 'queued' || i.status === 'failed').length);
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setFirebaseReady(true);
      } else if (authenticated) {
        signInAnonymously(auth).catch(err => console.error("Firebase Auth failed:", err));
      }
    });
    return () => unsubscribe();
  }, [authenticated]);

  useEffect(() => {
    if (authenticated && firebaseReady) refreshQueueCount();
  }, [authenticated, firebaseReady, refreshQueueCount]);

  // Auto-sync on reconnect
  useEffect(() => {
    const handler = () => {
      if (authenticated) refreshQueueCount();
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [authenticated, refreshQueueCount]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={login} onPinLogin={pinLogin} />} />
          <Route
            path="/*"
            element={
              authenticated ? (
                firebaseReady ? (
                  <Layout onLogout={logout} queueCount={queueCount}>
                    <AnimatePresence mode="wait">
                      <Routes>
                        <Route index element={<Dashboard />} />
                        <Route path="new" element={<NewSample onQueueUpdate={refreshQueueCount} />} />
                        <Route path="queue" element={<SubmissionQueue onQueueUpdate={refreshQueueCount} />} />
                        <Route path="history" element={<SampleHistory />} />
                        <Route path="incubation" element={<Incubation />} />
                        <Route path="results" element={<Results />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </AnimatePresence>
                  </Layout>
                ) : (
                  <div className="min-h-screen bg-[var(--bg-body)] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4 text-[var(--text-secondary)]">
                      <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-medium">Securing Cloud Connection...</p>
                    </div>
                  </div>
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
