import { useState } from 'react';
import { motion } from 'framer-motion';
import { Beaker, Mail, Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import Button from '../ui/Button';

interface LoginPageProps {
  onLogin: (username: string, password: string) => boolean;
  onPinLogin: (pin: string) => boolean;
}

export default function LoginPage({ onLogin, onPinLogin }: LoginPageProps) {
  const [mode, setMode] = useState<'password' | 'pin'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
          {/* Mode toggle */}
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

          {mode === 'password' ? (
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
        </div>
      </motion.div>
    </div>
  );
}
