import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Beaker, Mail, Lock, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import Button from '../ui/Button';
import { signInWithGooglePopup, signInWithGoogleRedirect } from '../../utils/auth';
import { auth } from '../../utils/firebase';
import { getRedirectResult } from 'firebase/auth';

interface LoginPageProps {
  onLogin: (username: string, password: string) => boolean;
  onPinLogin: (pin: string) => boolean;
  onGoogleLogin: (firstName: string) => void;
}

export default function LoginPage({ onLogin, onPinLogin, onGoogleLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'password' | 'pin' | 'google_access_code'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [tempGoogleUserName, setTempGoogleUserName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Check if we are returning from a Google Sign-In redirect
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        setGoogleLoading(true);
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const user = result.user;
          let firstName = 'User';
          if (user.displayName) {
            firstName = user.displayName.split(' ')[0];
          } else if (user.email) {
            firstName = user.email.split('@')[0];
          }
          setTempGoogleUserName(firstName);
          setMode('google_access_code');
        }
      } catch (e: any) {
        console.error('Google Redirect Error:', e);
        const errMsg = e.code ? `[Redirect: ${e.code}] ${e.message}` : e.message;
        setError(errMsg || 'Failed to retrieve redirect sign-in result');
      } finally {
        setGoogleLoading(false);
      }
    };
    handleRedirectResult();
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise((r) => setTimeout(r, 500));
    const success = onLogin(username, password);
    if (!success) {
      setError('Invalid username or password');
    }
    setLoading(false);
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length >= 8) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    if (newPin.length === 8) {
      setTimeout(() => {
        const success = onPinLogin(newPin);
        if (!success) {
          setError('Invalid PIN');
          setPin('');
        }
      }, 300);
    }
  };

  const handlePinDelete = () => {
    setPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleGoogleLogin = async () => {
    // Start the popup promise synchronously BEFORE updating any React state
    // to bypass browser's strict popup blocker detection!
    const popupPromise = signInWithGooglePopup();
    
    setGoogleLoading(true);
    setError('');
    
    try {
      const res = await popupPromise;
      if (res.success && res.firstName) {
        setTempGoogleUserName(res.firstName);
        setMode('google_access_code');
        setGoogleLoading(false);
      } else {
        if (res.error && res.error.includes('popup-blocked')) {
          setError('Popup blocked by browser. Redirecting to Google account page...');
          setTimeout(async () => {
            try {
              await signInWithGoogleRedirect();
            } catch (redirectError: any) {
              setError(redirectError.message || 'Redirect failed');
              setGoogleLoading(false);
            }
          }, 1500);
        } else {
          setError(res.error || 'Google login failed. Please try again.');
          setGoogleLoading(false);
        }
      }
    } catch (e: any) {
      console.error(e);
      if (e.message && e.message.includes('popup-blocked')) {
        setError('Popup blocked by browser. Redirecting to Google account page...');
        setTimeout(async () => {
          try {
            await signInWithGoogleRedirect();
          } catch (redirectError: any) {
            setError(redirectError.message || 'Redirect failed');
            setGoogleLoading(false);
          }
        }, 1500);
      } else {
        setError(e.message || 'An error occurred during Google login.');
        setGoogleLoading(false);
      }
    }
  };

  const handleAccessCodeDigit = (digit: string) => {
    if (accessCode.length >= 6) return;
    const newCode = accessCode + digit;
    setAccessCode(newCode);
    setError('');

    if (newCode.length === 6) {
      if (newCode === '090625') {
        setTimeout(() => {
          onGoogleLogin(tempGoogleUserName);
        }, 300);
      } else {
        setTimeout(() => {
          setError('Invalid access code');
          setAccessCode('');
        }, 300);
      }
    }
  };

  const handleCancelAccessCode = async () => {
    setAccessCode('');
    setTempGoogleUserName('');
    setError('');
    setMode('password');
    await auth.signOut().catch((e) => console.error(e));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-mesh">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary-500 to-accent-500
                        flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary-500/25"
          >
            <Beaker className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">SampleLog</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">QC Microbiology Lab</p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-6 lg:p-8">
          {/* Mode toggle (hidden when in access code verification) */}
          {mode !== 'google_access_code' && (
            <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-hover)] mb-6">
              <button
                onClick={() => { setMode('password'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
                           transition-all duration-200 cursor-pointer
                           ${mode === 'password' ? 'bg-[var(--bg-card-solid)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <Lock className="w-4 h-4" />
                Password
              </button>
              <button
                onClick={() => { setMode('pin'); setError(''); setPin(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
                           transition-all duration-200 cursor-pointer
                           ${mode === 'pin' ? 'bg-[var(--bg-card-solid)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <KeyRound className="w-4 h-4" />
                PIN
              </button>
            </div>
          )}

          {mode === 'google_access_code' ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-3 text-primary-500">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Enter Access Code</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Hi {tempGoogleUserName || 'User'}, enter the unskippable 6-digit access code for authorization.
                </p>
                <div className="flex justify-center gap-2.5 my-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={i < accessCode.length ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.2 }}
                      className={`pin-dot ${i < accessCode.length ? 'filled' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-danger-500 text-center"
                >
                  {error}
                </motion.p>
              )}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'cancel'].map((key) => (
                  <motion.button
                    key={key || 'empty'}
                    whileTap={key ? { scale: 0.9 } : {}}
                    type="button"
                    onClick={() => {
                      if (key === 'del') {
                        setAccessCode((c) => c.slice(0, -1));
                        setError('');
                      } else if (key === 'cancel') {
                        handleCancelAccessCode();
                      } else if (key) {
                        handleAccessCodeDigit(key);
                      }
                    }}
                    className={`
                      h-12 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer
                      ${
                        key === 'cancel'
                          ? 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                          : key === 'del'
                          ? 'text-danger-500 hover:bg-danger-500/10'
                          : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-primary-500/10'
                      }
                    `}
                  >
                    {key === 'del' ? '⌫' : key === 'cancel' ? 'Back' : key}
                  </motion.button>
                ))}
              </div>
            </div>
          ) : mode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[var(--text-secondary)]">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-danger-500 text-center"
                >
                  {error}
                </motion.p>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Sign In
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-[var(--text-secondary)] mb-4">Enter your 8-digit PIN</p>
                <div className="flex justify-center gap-2.5 mb-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <motion.div
                      key={i}
                      animate={i < pin.length ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 0.2 }}
                      className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-sm text-danger-500 text-center"
                >
                  {error}
                </motion.p>
              )}

              {/* Number pad */}
              <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => (
                  <motion.button
                    key={key || 'empty'}
                    whileTap={key ? { scale: 0.9 } : {}}
                    type="button"
                    disabled={!key}
                    onClick={() => {
                      if (key === 'del') handlePinDelete();
                      else if (key) handlePinDigit(key);
                    }}
                    className={`
                      h-14 rounded-2xl text-lg font-semibold transition-all duration-150 cursor-pointer
                      ${
                        !key
                          ? 'invisible'
                          : key === 'del'
                          ? 'text-danger-500 hover:bg-danger-500/10'
                          : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-primary-500/10'
                      }
                    `}
                  >
                    {key === 'del' ? '⌫' : key}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Google Sign In Divider & Button */}
          {mode !== 'google_access_code' && (
            <div className="mt-6 pt-6 border-t border-[var(--border-subtle)] space-y-4">
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
                <span className="flex-shrink mx-4 text-xs text-[var(--text-muted)] font-medium">Or continue with</span>
                <div className="flex-grow border-t border-[var(--border-subtle)]"></div>
              </div>
              
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="
                  w-full flex items-center justify-center gap-3 px-4 py-3
                  bg-[var(--bg-input)] hover:bg-[var(--bg-hover)] active:bg-primary-500/10
                  border border-[var(--border-color)] hover:border-primary-400
                  rounded-2xl text-sm font-semibold text-[var(--text-primary)]
                  transition-all duration-200 cursor-pointer
                  focus:outline-none focus:ring-3 focus:ring-primary-500/15
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {googleLoading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.68 1.37 7.6l3.86 3C6.15 7.6 8.85 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.4-4.94 3.4-8.69z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.23 14.73c-.24-.73-.38-1.5-.38-2.3s.14-1.57.38-2.3L1.37 7.13C.5 8.9 0 10.9 0 13s.5 4.1 1.37 5.87l3.86-3.14z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-3.96 1.1-3.15 0-5.85-2.56-6.8-5.59l-3.86 3C3.68 20.18 7.65 23 12 23z"
                    />
                  </svg>
                )}
                {googleLoading ? 'Connecting...' : 'Google Account'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
