import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Save, Wifi, WifiOff, Trash2, Lock, Unlock, ShieldCheck, LogOut, RefreshCw, AlertTriangle, CheckCircle2, Table2 } from 'lucide-react';
import PersonnelEditor from '../components/settings/PersonnelEditor';
import Header from '../components/Layout/Header';
import TextInput from '../components/ui/TextInput';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { getSettings, saveSettings, saveSheetPreference, listenToSheetPreference } from '../utils/auth';
import { fetchHistoryFromSheet } from '../utils/api';
import { clearHistory, clearQueue, importHistoryBatch } from '../utils/db';
import { SPREADSHEETS } from '../data/constants';
import { getSheetTabName } from '../utils/sheetMapping';
import { useTheme } from '../hooks/useTheme';

export default function Settings({ onLogout }: { onLogout?: () => void }) {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState(getSettings());
  const [isLocked, setIsLocked] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const ADMIN_PASSWORD = 'uqRaRrb4rc7!';

  useEffect(() => { setSettings(getSettings()); }, []);

  useEffect(() => {
    const unsubscribe = listenToSheetPreference((spreadsheetId) => {
      setSettings((prev: any) => ({ ...prev, spreadsheetId }));
    });
    return () => unsubscribe();
  }, []);

  const handleUnlock = () => {
    if (password === ADMIN_PASSWORD) {
      setIsLocked(false);
      setShowPasswordPrompt(false);
      setPassword('');
      showToast('success', 'Unlocked', 'Administrative settings are now editable');
    } else {
      showToast('error', 'Incorrect Password', 'Access denied');
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    showToast('success', 'Settings Saved');
  };

  const handleClearData = async () => {
    await clearHistory();
    await clearQueue();
    showToast('info', 'Data Cleared', 'All local data has been removed');
  };

  return (
    <div>
      <Header theme={theme} onSetTheme={setTheme} title="Settings" />
      <div className="px-4 lg:px-8 max-w-2xl space-y-6">
        
        {/* Header with Lock Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h2>
            <p className="text-sm text-[var(--text-secondary)]">Manage app configuration and connectivity</p>
          </div>
          <button
            onClick={() => isLocked ? setShowPasswordPrompt(true) : setIsLocked(true)}
            className={`w-full sm:w-auto flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              isLocked 
                ? 'bg-[var(--bg-input)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-primary-500'
                : 'bg-primary-500/10 border-primary-500/20 text-primary-500'
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span className="text-sm font-bold uppercase tracking-wider">
              {isLocked ? 'Protected' : 'Unlocked'}
            </span>
          </button>
        </div>

        <AnimatePresence>
          {showPasswordPrompt && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass rounded-2xl p-6 border-2 border-primary-500/30 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-primary-500" />
                </div>
                <div>
                  <h3 className="font-bold text-[var(--text-primary)]">Admin Verification Required</h3>
                  <p className="text-xs text-[var(--text-secondary)]">Enter password to modify core configuration</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password..."
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                />
                <button
                  onClick={handleUnlock}
                  className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-2 px-6 rounded-xl transition-all shadow-lg shadow-primary-500/20"
                >
                  Verify
                </button>
                <button
                  onClick={() => setShowPasswordPrompt(false)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-6">


          {/* Sheet ID */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Google Sheet</h4>
              {isLocked && <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            </div>
            
            <div className={isLocked ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}>
              <div className="flex p-1 bg-[var(--bg-input)] rounded-xl border border-[var(--border-subtle)]">
                <button
                  onClick={() => { setSettings({ ...settings, spreadsheetId: SPREADSHEETS.practice }); saveSheetPreference(SPREADSHEETS.practice); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    settings.spreadsheetId === SPREADSHEETS.practice
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Practice Sheet
                </button>
                <button
                  onClick={() => { setSettings({ ...settings, spreadsheetId: SPREADSHEETS.official }); saveSheetPreference(SPREADSHEETS.official); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    settings.spreadsheetId === SPREADSHEETS.official
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Official Sheet
                </button>
              </div>

              <div className="mt-4">
                <TextInput label="Custom Spreadsheet ID" value={settings.spreadsheetId} onChange={(v) => setSettings({ ...settings, spreadsheetId: v })} />
                <p className="text-xs text-[var(--text-muted)] italic mt-2">
                  Currently using: {settings.spreadsheetId === SPREADSHEETS.practice ? 'Practice Mode' : settings.spreadsheetId === SPREADSHEETS.official ? 'Production Mode' : 'Custom ID'}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Personnel Editor */}
          <PersonnelEditor />

          {/* Save */}
          <Button size="lg" icon={<Save className="w-4 h-4" />} onClick={handleSave} className="w-full">
            Save Settings
          </Button>

          {/* Account Section */}
          <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            <div className="p-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <LogOut className="w-4 h-4 text-danger-500" />
                Account
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Sign out of your account on this device.
              </p>
              <button
                onClick={() => {
                  if (onLogout) {
                    onLogout();
                  } else {
                    localStorage.removeItem('sample_logger_auth');
                    window.location.replace('/login');
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-danger-500/10 text-danger-500 hover:bg-danger-500/20 rounded-xl font-bold transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out from Device
              </button>
            </div>
          </div>

          {/* Sync Utility */}
          <div className="glass rounded-2xl border border-[var(--border-subtle)] overflow-hidden">
            <div className="p-6">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-primary-500 ${isSyncing ? 'animate-spin' : ''}`} />
                Cloud Reconciliation
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                If your phone and PC are different, this will force a full reload from the cloud.
              </p>
              <button
                onClick={async () => {
                  setIsSyncing(true);
                  try {
                    const updatedIds = await fetchHistoryFromSheet();
                    if (updatedIds.length > 0) {
                      showToast('success', 'Sync Complete!', `Synced ${updatedIds.length} items with cloud.`);
                    } else {
                      showToast('warning', 'No data found', 'No items in cloud.');
                    }
                  } catch (e) {
                    showToast('error', 'Sync failed', 'Check your connection.');
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Everything Now'}
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl border border-red-500/30 overflow-hidden mt-6">
            <div className="p-6">
              <h3 className="text-sm font-bold text-red-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Danger Zone
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                If you cleared your Google Sheet and want to wipe your app's local History tab to match, click here. This cannot be undone.
              </p>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete all local history data?')) {
                    handleClearData();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl font-bold transition-all"
              >
                Clear Local History & Queue
              </button>
            </div>
          </div>

          <div className="text-center py-8">
            <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-[0.2em]">
              Microbiology Lab Logger v2.5.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

