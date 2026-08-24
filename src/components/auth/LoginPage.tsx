import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Beaker, Mail, Lock, Eye, EyeOff, KeyRound, ShieldAlert, User, AlertTriangle } from 'lucide-react';
import Button from '../ui/Button';
import { signInWithGooglePopup, signInWithGoogleRedirect, saveGoogleUserProfile, getGoogleUserProfile } from '../../utils/auth';
import { auth } from '../../utils/firebase';
import { getRedirectResult } from 'firebase/auth';

// Access code is 8 digits: 09062025
const ACCESS_CODE = '09062025';
const MAX_ATTEMPTS = 5;

type LoginMode = 'password' | 'pin' | 'google_access_code' | 'google_setup';

interface LoginPageProps {
  onLogin: (username: string, password: string) => boolean;
  onPinLogin: (pin: string) => Promise<boolean> | boolean;
  onGoogleLogin: (firstName: string) => void;
}

export default function LoginPage({ onLogin, onPinLogin, onGoogleLogin }: LoginPageProps) {
  const [mode, setMode] = useState<LoginMode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [accessAttempts, setAccessAttempts] = useState(0);
  const [tempGoogleUserName, setTempGoogleUserName] = useState('');
  const [tempGoogleUid, setTempGoogleUid] = useState('');
  // Setup state for first-time users
  const [setupName, setSetupName] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [setupStep, setSetupStep] = useState<'name' | 'pin' | 'pin_confirm'>('name');
  const [setupLoading, setSetupLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // On mount: check if returning from Google redirect OR if a Google user is already signed in
  useEffect(() => {
    // 1. Listen for auth state changes to detect Google sign-in
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const isGoogle = user.providerData.some((p) => p.providerId === 'google.com') ||
                         (user.email && !user.isAnonymous);
        if (isGoogle) {
          let firstName = 'User';
          if (user.displayName) {
            firstName = user.displayName.split(' ')[0];
          } else if (user.email) {
            firstName = user.email.split('@')[0];
          }
          setTempGoogleUid(user.uid);
          setTempGoogleUserName(firstName);

          // Check if this user already has a profile in Firestore
          const profile = await getGoogleUserProfile(user.uid);
          if (profile) {
            // Returning user — go straight to access code
            setSetupName(profile.name);
            setMode('google_access_code');
          } else {
            // First-time user — go to setup
            setSetupName(firstName);
            setSetupStep('name');
            setMode('google_setup');
          }
        }
      }
    });

    // 2. Also check redirect result
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          const user = result.user;
          let firstName = 'User';
          if (user.displayName) firstName = user.displayName.split(' ')[0];
          else if (user.email) firstName = user.email.split('@')[0];
          setTempGoogleUid(user.uid);
          setTempGoogleUserName(firstName);

          const profile = await getGoogleUserProfile(user.uid);
          if (profile) {
            setSetupName(profile.name);
            setMode('google_access_code');
          } else {
            setSetupName(firstName);
            setSetupStep('name');
            setMode('google_setup');
          }
        }
      } catch (e: any) {
        console.error('Google Redirect Error:', e);
        const errMsg = e.code ? `[Redirect: ${e.code}] ${e.message}` : e.message;
        setError(errMsg || 'Failed to retrieve redirect sign-in result');
      }
    };

    handleRedirectResult();
    return () => unsubscribe();
  }, []);

  // ===== KEYBOARD SUPPORT FOR PIN =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a text input field (like Password or Name setup)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (mode === 'pin') {
        if (/^[0-9]$/.test(e.key)) handlePinDigit(e.key);
        else if (e.key === 'Backspace') handlePinDelete();
      } else if (mode === 'google_access_code') {
        if (/^[0-9]$/.test(e.key)) handleAccessCodeDigit(e.key);
        else if (e.key === 'Backspace') {
          setAccessCode((c) => c.slice(0, -1));
          setError('');
        }
      } else if (mode === 'google_setup' && (setupStep === 'pin' || setupStep === 'pin_confirm')) {
        const isConfirm = setupStep === 'pin_confirm';
        if (/^[0-9]$/.test(e.key)) handleSetupPinDigit(e.key, isConfirm);
        else if (e.key === 'Backspace') handleSetupPinDelete(isConfirm);
        else if (e.key === 'Enter' && setupStep === 'pin' && setupPin.length === 8) handleSetupSubmit();
        else if (e.key === 'Enter' && setupStep === 'pin_confirm' && setupPinConfirm.length === 8) handleSetupSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, pin, accessCode, setupStep, setupPin, setupPinConfirm]);

  // ===== PASSWORD LOGIN =====
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise((r) => setTimeout(r, 500));
    const success = onLogin(username, password);
    if (!success) setError('Invalid username or password');
    setLoading(false);
  };

  // ===== PIN LOGIN =====
  const handlePinDigit = (digit: string) => {
    if (pin.length >= 8) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError('');
    if (newPin.length === 8) {
      setTimeout(async () => {
        const success = await onPinLogin(newPin);
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

  // ===== GOOGLE LOGIN =====
  const handleGoogleLogin = async () => {
    const popupPromise = signInWithGooglePopup();
    setGoogleLoading(true);
    setError('');
    try {
      const res = await popupPromise;
      if (res.success && res.firstName && res.uid) {
        setTempGoogleUid(res.uid);
        setTempGoogleUserName(res.firstName);
        setGoogleLoading(false);
        // Profile check handled by onAuthStateChanged above
      } else {
        if (res.error && res.error.includes('popup-blocked')) {
          setError('Popup blocked. Redirecting to Google...');
          setTimeout(async () => {
            try { await signInWithGoogleRedirect(); }
            catch (redirectError: any) { setError(redirectError.message || 'Redirect failed'); setGoogleLoading(false); }
          }, 1500);
        } else {
          setError(res.error || 'Google login failed. Please try again.');
          setGoogleLoading(false);
        }
      }
    } catch (e: any) {
      if (e.message && e.message.includes('popup-blocked')) {
        setError('Popup blocked. Redirecting to Google...');
        setTimeout(async () => {
          try { await signInWithGoogleRedirect(); }
          catch (redirectError: any) { setError(redirectError.message || 'Redirect failed'); setGoogleLoading(false); }
        }, 1500);
      } else {
        setError(e.message || 'An error occurred during Google login.');
        setGoogleLoading(false);
      }
    }
  };

  // ===== ACCESS CODE =====
  const handleAccessCodeDigit = (digit: string) => {
    if (accessCode.length >= 8) return;
    const newCode = accessCode + digit;
    setAccessCode(newCode);
    setError('');

    if (newCode.length === 8) {
      setTimeout(() => {
        if (newCode === ACCESS_CODE) {
          onGoogleLogin(setupName || tempGoogleUserName);
        } else {
          const nextAttempts = accessAttempts + 1;
          setAccessAttempts(nextAttempts);
          if (nextAttempts >= MAX_ATTEMPTS) {
            // Auto-logout after 5 wrong attempts
            setError(`Too many wrong attempts. Signing out...`);
            setTimeout(() => {
              auth.signOut().catch(() => {});
              setMode('password');
              setAccessCode('');
              setAccessAttempts(0);
              setTempGoogleUid('');
              setTempGoogleUserName('');
              setSetupName('');
              setError('');
            }, 2000);
          } else {
            setError(`Wrong access code. ${MAX_ATTEMPTS - nextAttempts} attempt${MAX_ATTEMPTS - nextAttempts === 1 ? '' : 's'} left.`);
            setAccessCode('');
          }
        }
      }, 300);
    }
  };

  // ===== FIRST-TIME SETUP =====
  const handleSetupPinDigit = (digit: string, isConfirm: boolean) => {
    const current = isConfirm ? setupPinConfirm : setupPin;
    if (current.length >= 8) return;
    const updated = current + digit;
    if (isConfirm) setSetupPinConfirm(updated);
    else setSetupPin(updated);
    setError('');
  };

  const handleSetupPinDelete = (isConfirm: boolean) => {
    if (isConfirm) setSetupPinConfirm((p) => p.slice(0, -1));
    else setSetupPin((p) => p.slice(0, -1));
    setError('');
  };

  const handleSetupSubmit = async () => {
    if (setupStep === 'name') {
      if (!setupName.trim()) { setError('Please enter your name'); return; }
      setSetupStep('pin');
      setError('');
      return;
    }
    if (setupStep === 'pin') {
      if (setupPin.length < 8) { setError('PIN must be 8 digits'); return; }
      setSetupStep('pin_confirm');
      setError('');
      return;
    }
    if (setupStep === 'pin_confirm') {
      if (setupPinConfirm !== setupPin) {
        setError('PINs do not match. Try again.');
        setSetupPinConfirm('');
        return;
      }
      // Save profile to Firestore
      setSetupLoading(true);
      try {
        await saveGoogleUserProfile(tempGoogleUid, setupName.trim(), setupPin);
        setSetupLoading(false);
        // Now proceed to access code gate
        setMode('google_access_code');
        setAccessCode('');
        setAccessAttempts(0);
        setError('');
      } catch (e) {
        setSetupLoading(false);
        setError('Failed to save profile. Check your connection and try again.');
      }
    }
  };

  // ===== NUMPAD RENDERER =====
  const NumPad = ({
    onDigit,
    onDelete,
    onExtra,
    extraLabel,
    extraDanger,
  }: {
    onDigit: (d: string) => void;
    onDelete: () => void;
    onExtra?: () => void;
    extraLabel?: string;
    extraDanger?: boolean;
  }) => (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'extra', '0', 'del'].map((key) => (
        <motion.button
          key={key}
          whileTap={key !== 'extra' || onExtra ? { scale: 0.88 } : {}}
          type="button"
          onClick={() => {
            if (key === 'del') onDelete();
            else if (key === 'extra' && onExtra) onExtra();
            else if (key !== 'extra') onDigit(key);
          }}
          disabled={key === 'extra' && !onExtra}
          className={`
            h-14 rounded-2xl text-base font-bold transition-all duration-150 cursor-pointer select-none
            ${
              key === 'del'
                ? 'text-danger-500 hover:bg-danger-500/10 active:bg-danger-500/20 text-lg'
                : key === 'extra' && !onExtra
                ? 'invisible'
                : key === 'extra' && extraDanger
                ? `text-xs ${extraDanger ? 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]' : 'text-primary-500 hover:bg-primary-500/10'}`
                : key === 'extra'
                ? 'text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-primary-500/10 shadow-sm'
            }
          `}
        >
          {key === 'del' ? '⌫' : key === 'extra' ? extraLabel || '' : key}
        </motion.button>
      ))}
    </div>
  );

  // ===== DOT DISPLAY =====
  const DotRow = ({ count, filled }: { count: number; filled: number }) => (
    <div className="flex justify-center gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          animate={i < filled ? { scale: [1, 1.25, 1] } : {}}
          transition={{ duration: 0.18 }}
          className={`pin-dot ${i < filled ? 'filled' : ''}`}
        />
      ))}
    </div>
  );

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
          <p className="text-[10px] text-[var(--text-muted)] mt-1.5 opacity-50 tracking-wide">
            developed &amp; maintained by R. Codinera
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-6 lg:p-8">
          {/* Mode toggle (only when not in Google flows) */}
          {(mode === 'password' || mode === 'pin') && (
            <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-hover)] mb-6">
              <button
                onClick={() => { setMode('password'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
                           transition-all duration-200 cursor-pointer
                           ${mode === 'password' ? 'bg-[var(--bg-card-solid)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <Lock className="w-4 h-4" /> Password
              </button>
              <button
                onClick={() => { setMode('pin'); setError(''); setPin(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium
                           transition-all duration-200 cursor-pointer
                           ${mode === 'pin' ? 'bg-[var(--bg-card-solid)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}
              >
                <KeyRound className="w-4 h-4" /> PIN
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ===== ACCESS CODE MODE ===== */}
            {mode === 'google_access_code' && (
              <motion.div key="access_code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center mx-auto mb-3 text-primary-500">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)]">Access Code Required</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Hi <span className="font-semibold text-primary-500">{setupName || tempGoogleUserName || 'User'}</span>, enter the 8-digit access code to continue.
                  </p>
                  <div className="my-5">
                    <DotRow count={8} filled={accessCode.length} />
                  </div>
                  {accessAttempts > 0 && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-amber-500 font-medium mb-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {MAX_ATTEMPTS - accessAttempts} attempt{MAX_ATTEMPTS - accessAttempts === 1 ? '' : 's'} remaining
                    </div>
                  )}
                </div>
                {error && (
                  <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-danger-500 text-center font-medium">
                    {error}
                  </motion.p>
                )}
                <NumPad onDigit={handleAccessCodeDigit} onDelete={() => { setAccessCode((c) => c.slice(0, -1)); setError(''); }} />
                <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">This screen cannot be skipped</p>
              </motion.div>
            )}

            {/* ===== FIRST-TIME SETUP MODE ===== */}
            {mode === 'google_setup' && (
              <motion.div key="google_setup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  {['Name', 'PIN', 'Confirm'].map((step, i) => {
                    const stepIdx = setupStep === 'name' ? 0 : setupStep === 'pin' ? 1 : 2;
                    return (
                      <div key={step} className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i <= stepIdx ? 'bg-primary-500 text-white' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>
                          {i + 1}
                        </div>
                        {i < 2 && <div className={`w-8 h-0.5 transition-all ${i < stepIdx ? 'bg-primary-500' : 'bg-[var(--border-subtle)]'}`} />}
                      </div>
                    );
                  })}
                </div>

                {setupStep === 'name' && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3 text-emerald-500">
                        <User className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">Welcome!</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Set up your profile for first-time access</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-[var(--text-secondary)]">Your Display Name</label>
                      <input
                        type="text"
                        value={setupName}
                        onChange={(e) => setSetupName(e.target.value)}
                        placeholder="Enter your name"
                        className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSetupSubmit()}
                      />
                    </div>
                    {error && <p className="text-sm text-danger-500 text-center">{error}</p>}
                    <Button onClick={handleSetupSubmit} className="w-full" size="lg">
                      Continue
                    </Button>
                  </div>
                )}

                {(setupStep === 'pin' || setupStep === 'pin_confirm') && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center mx-auto mb-3 text-violet-500">
                        <KeyRound className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)]">
                        {setupStep === 'pin' ? 'Set Your 8-Digit PIN' : 'Confirm Your PIN'}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {setupStep === 'pin' ? 'This PIN will be your quick login method' : 'Re-enter the same PIN to confirm'}
                      </p>
                      <div className="my-5">
                        <DotRow count={8} filled={setupStep === 'pin' ? setupPin.length : setupPinConfirm.length} />
                      </div>
                    </div>
                    {error && (
                      <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-danger-500 text-center">
                        {error}
                      </motion.p>
                    )}
                    <NumPad
                      onDigit={(d) => handleSetupPinDigit(d, setupStep === 'pin_confirm')}
                      onDelete={() => handleSetupPinDelete(setupStep === 'pin_confirm')}
                      onExtra={setupStep === 'pin' && setupPin.length === 8 ? handleSetupSubmit : undefined}
                      extraLabel={setupStep === 'pin' ? 'Next →' : undefined}
                    />
                    {setupStep === 'pin_confirm' && setupPinConfirm.length === 8 && (
                      <Button onClick={handleSetupSubmit} loading={setupLoading} className="w-full" size="lg">
                        {setupLoading ? 'Saving...' : 'Complete Setup'}
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ===== PASSWORD MODE ===== */}
            {mode === 'password' && (
              <motion.div key="password" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[var(--text-secondary)]">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input type="email" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your email" className="w-full pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[var(--text-secondary)]">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                      <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full pl-10 pr-10" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-pointer">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-danger-500 text-center">
                      {error}
                    </motion.p>
                  )}
                  <Button type="submit" loading={loading} className="w-full" size="lg">Sign In</Button>
                </form>
              </motion.div>
            )}

            {/* ===== PIN MODE ===== */}
            {mode === 'pin' && (
              <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                <div className="text-center">
                  <p className="text-sm text-[var(--text-secondary)] mb-4">Enter your 8-digit PIN</p>
                  <DotRow count={8} filled={pin.length} />
                </div>
                {error && (
                  <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-danger-500 text-center">
                    {error}
                  </motion.p>
                )}
                <NumPad onDigit={handlePinDigit} onDelete={handlePinDelete} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Google Sign In button (only on password/pin modes) */}
          {(mode === 'password' || mode === 'pin') && (
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
                    <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.68 1.37 7.6l3.86 3C6.15 7.6 8.85 5.04 12 5.04z" />
                    <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.27H12v4.51h6.44c-.28 1.48-1.12 2.73-2.38 3.58l3.7 2.87c2.16-2 3.4-4.94 3.4-8.69z" />
                    <path fill="#FBBC05" d="M5.23 14.73c-.24-.73-.38-1.5-.38-2.3s.14-1.57.38-2.3L1.37 7.13C.5 8.9 0 10.9 0 13s.5 4.1 1.37 5.87l3.86-3.14z" />
                    <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.03.69-2.35 1.1-3.96 1.1-3.15 0-5.85-2.56-6.8-5.59l-3.86 3C3.68 20.18 7.65 23 12 23z" />
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
