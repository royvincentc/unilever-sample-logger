import { useState, useEffect, useCallback } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './utils/firebase';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
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
import LiveSheetView from './pages/LiveSheetView';
import Logbook from './pages/Logbook';
import Calendar from './pages/Calendar';

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

interface AppContentProps {
  authenticated: boolean;
  firebaseReady: boolean;
  logout: () => void;
  login: any;
  pinLogin: any;
  googleLogin: any;
  queueCount: number;
  refreshQueueCount: () => void;
}

function AppContent({
  authenticated,
  firebaseReady,
  logout,
  login,
  pinLogin,
  googleLogin,
  queueCount,
  refreshQueueCount,
}: AppContentProps) {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authenticated ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={login} onPinLogin={pinLogin} onGoogleLogin={googleLogin} />
          )
        }
      />
      <Route
        path="/*"
        element={
          authenticated ? (
            firebaseReady ? (
              <Layout onLogout={logout} queueCount={queueCount}>
                <AnimatePresence mode="wait">
                  <Routes location={location} key={location.pathname}>
                    <Route index element={<PageTransition><Dashboard theme={theme} onSetTheme={setTheme} queueCount={queueCount} /></PageTransition>} />
                    <Route path="new" element={<PageTransition><NewSample onQueueUpdate={refreshQueueCount} /></PageTransition>} />
                    <Route path="queue" element={<PageTransition><SubmissionQueue onQueueUpdate={refreshQueueCount} /></PageTransition>} />
                    <Route path="history" element={<PageTransition><SampleHistory /></PageTransition>} />
                    <Route path="live" element={<PageTransition><LiveSheetView /></PageTransition>} />
                    <Route path="logbook" element={<PageTransition><Logbook /></PageTransition>} />
                    <Route path="incubation" element={<PageTransition><Incubation /></PageTransition>} />
                    <Route path="results" element={<PageTransition><Results /></PageTransition>} />
                    <Route path="settings" element={<PageTransition><Settings onLogout={logout} /></PageTransition>} />
                    <Route path="calendar" element={<PageTransition><Calendar /></PageTransition>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </AnimatePresence>
              </Layout>
            ) : (
              <div className="min-h-screen bg-[var(--bg-body)] flex items-center justify-center p-6 text-center">
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">Securing Cloud Connection...</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Establishing a secure session with Unilever QC Cloud</p>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-4 text-xs text-primary-500 hover:underline cursor-pointer"
                  >
                    Taking too long? Click here to refresh.
                  </button>
                </div>
              </div>
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  const { theme, setTheme } = useTheme();
  const { authenticated, login, pinLogin, googleLogin, logout } = useAuth();
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
      } else {
        signInAnonymously(auth).catch(err => console.error("Firebase Auth failed:", err));
      }
    });
    return () => unsubscribe();
  }, []);

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
        <AppContent
          authenticated={authenticated}
          firebaseReady={firebaseReady}
          logout={logout}
          login={login}
          pinLogin={pinLogin}
          googleLogin={googleLogin}
          queueCount={queueCount}
          refreshQueueCount={refreshQueueCount}
        />
      </BrowserRouter>
    </ToastProvider>
  );
}
