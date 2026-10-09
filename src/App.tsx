import { useState, useEffect, useCallback } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './utils/firebase';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'framer-motion';
import ScienceGraphic from './components/ui/ScienceGraphic';
import { panelTransition } from './design/motion';
import { RefreshCw } from 'lucide-react';
import Layout from './components/Layout/Layout';
import LoginPage from './components/auth/LoginPage';
import { ToastProvider } from './components/ui/Toast';
import { useTheme } from './hooks/useTheme';
import { useAuth } from './hooks/useAuth';
import { startPersonnelSync } from './hooks/usePersonnel';
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
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? { duration: 0 } : panelTransition}
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
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-6 text-center"
              >
                <div className="flex flex-col items-center gap-6 max-w-sm">
                  <ScienceGraphic kind="sync" animated className="w-40 h-32" />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-sm font-bold text-[var(--text-primary)] mb-1.5 tracking-tight">Securing Cloud Connection...</p>
                    <p className="text-[11px] font-medium text-[var(--text-muted)] leading-relaxed">Establishing a secure session with<br/>Unilever QC Cloud infrastructure.</p>
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 3 }}
                    onClick={() => window.location.reload()}
                    className="mt-2 text-[10px] font-semibold text-primary-500 hover:text-primary-600 transition-colors cursor-pointer px-3 py-1.5 bg-primary-500/10 rounded-full"
                  >
                    Taking too long? Tap to force refresh
                  </motion.button>
                </div>
              </motion.div>
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

  useEffect(() => {
    if (authenticated && firebaseReady) return startPersonnelSync();
  }, [authenticated, firebaseReady]);

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

  useEffect(() => {
    const update = () => document.documentElement.classList.toggle('document-hidden', document.visibilityState === 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => { document.removeEventListener('visibilitychange', update); document.documentElement.classList.remove('document-hidden'); };
  }, []);

  // Auto-sync on reconnect
  useEffect(() => {
    const handler = () => {
      if (authenticated) refreshQueueCount();
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [authenticated, refreshQueueCount]);

  return (
    <MotionConfig reducedMotion="user"><ToastProvider>
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
    </ToastProvider></MotionConfig>
  );
}
