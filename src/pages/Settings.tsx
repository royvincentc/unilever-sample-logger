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
import { testWebhookConnection, fetchHistoryFromSheet, fetchSheetSchema } from '../utils/api';
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
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [schemaData, setSchemaData] = useState<Record<string, string[]>>({});
  const [schemaLoading, setSchemaLoading] = useState<string | null>(null);

  // Expected logical field names per sample type (used to detect renames)
  const EXPECTED_FIELDS: Record<string, string[]> = {
    ENVI: ['CONTROL #', 'SAMPLE', 'QTY', 'UNIT', 'DATE SWABBED', 'TIME SWABBED', 'SWABBED BY', 'ENDORSED TO', 'DATE ANALYZED', 'ANALYZED BY', 'STATUS', 'REMARKS'],
    WATER: ['CONTROL #', 'WATER SOURCE', 'QTY', 'UNIT', 'DATE SAMPLED', 'TIME', 'SAMPLED BY', 'ENDORSED TO', 'DATE ANALYZED', 'ANALYZED BY', 'STATUS', 'REMARKS'],
    RawMats: ['CONTROL #', 'TYPE', 'RFAF', 'MIXING BATCH #', 'CUC #', 'SAMPLE', 'SOURCE', 'QTY', 'UNIT', 'DATE RECEIVED/SAMPLED', 'TIME', 'RECEIVED BY', 'ENDORSED TO', 'DATE ANALYZED', 'ANALYZED BY', 'STATUS', 'REMARKS'],
  };

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

  // Fetch the live column headers from the sheet for a given sample type
  const handleFetchSchema = async (sampleType: 'ENVI' | 'WATER' | 'RawMats') => {
    const sheetTab = getSheetTabName(sampleType);
    setSchemaLoading(sampleType);
    try {
      const headers = await fetchSheetSchema(sheetTab);
      if (headers.length > 0) {
        setSchemaData(prev => ({ ...prev, [sampleType]: headers }));
        showToast('success', 'Schema Loaded', `${headers.length} columns found in ${sheetTab}`);
      } else {
        showToast('warning', 'No Headers Found', 'Check your schema webhook URL or sheet tab name');
      }
    } catch {
      showToast('error', 'Schema Fetch Failed', 'Could not read sheet headers');
    } finally {
      setSchemaLoading(null);
    }
  };

  const handleTest = async (url: string, key: 'envi' | 'water' | 'rawmats') => {
    if (!url) { showToast('warning', 'No URL', 'Enter a webhook URL first'); return; }
    setTesting(key);
    const ok = await testWebhookConnection(url);
    setTestResults((p) => ({ ...p, [key]: ok }));
    setTesting(null);
    showToast(ok ? 'success' : 'error', ok ? 'Connected!' : 'Failed', `${key.toUpperCase()} webhook ${ok ? 'is reachable' : 'unreachable'}`);
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h2>
            <p className="text-sm text-[var(--text-secondary)]">Manage app configuration and connectivity</p>
          </div>
          <button
            onClick={() => isLocked ? setShowPasswordPrompt(true) : setIsLocked(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
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
          {/* Webhooks */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">n8n Webhooks</h4>
              {isLocked && <Lock className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
            </div>
            <div className={isLocked ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}>
              <TextInput label="ENVI Webhook URL" value={settings.webhookUrls.envi} onChange={(v) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, envi: v } })} />
              <button onClick={() => handleTest(settings.webhookUrls.envi, 'envi')} className="text-xs text-primary-500 hover:underline mt-1 font-medium">Test</button>
              
              <div className="mt-4">
                <TextInput label="WATER Webhook URL" value={settings.webhookUrls.water} onChange={(v) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, water: v } })} />
                <button onClick={() => handleTest(settings.webhookUrls.water, 'water')} className="text-xs text-primary-500 hover:underline mt-1 font-medium">Test</button>
              </div>
              
              <div className="mt-4">
                <TextInput label="RawMats Webhook URL" value={settings.webhookUrls.rawmats} onChange={(v) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, rawmats: v } })} />
                <button onClick={() => handleTest(settings.webhookUrls.rawmats, 'rawmats')} className="text-xs text-primary-500 hover:underline mt-1 font-medium">Test</button>
              </div>

              <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                <TextInput label="Sync History Webhook URL" value={settings.webhookUrls.sync || ''} onChange={(v) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, sync: v } })} />
                <p className="text-xs text-[var(--text-muted)] italic mt-1">Optional: Used for manual cloud reconciliation.</p>
              </div>

              <div className="mt-4">
                <TextInput label="Live Sheet Webhook URL" value={settings.webhookUrls.liveSheet || ''} onChange={(v) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, liveSheet: v } })} />
                <p className="text-xs text-[var(--text-muted)] italic mt-1">Optional: Used for the Live Sheet tab.</p>
              </div>

              <div className="mt-4">
                <TextInput label="Schema Webhook URL" value={(settings.webhookUrls as any).schema || ''} onChange={(v) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, schema: v } as any })} />
                <p className="text-xs text-[var(--text-muted)] italic mt-1">Same as Live Sheet URL — used to read column headers for auto-mapping.</p>
              </div>
            </div>
          </motion.div>

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

          {/* Column Mapping Health Check */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table2 className="w-4 h-4 text-primary-500" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Column Mapping Health</h4>
              </div>
              <span className="text-xs text-[var(--text-muted)]">Detects renamed columns</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Click <strong>Check</strong> next to each sample type to read live column headers from your Google Sheet and verify nothing has been renamed.
            </p>
            {(['ENVI', 'WATER', 'RawMats'] as const).map((type) => {
              const liveHeaders = schemaData[type] ?? [];
              const expected = EXPECTED_FIELDS[type];
              const mismatches = expected.filter(f => {
                if (liveHeaders.length === 0) return false;
                return !liveHeaders.some(h =>
                  h === f ||
                  h.toUpperCase() === f.toUpperCase() ||
                  h.toLowerCase().includes(f.toLowerCase().split(' ')[0])
                );
              });
              return (
                <div key={type} className="border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">{type}</span>
                      {liveHeaders.length > 0 && mismatches.length === 0 && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> All columns matched
                        </span>
                      )}
                      {liveHeaders.length > 0 && mismatches.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" /> {mismatches.length} possible rename(s)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleFetchSchema(type)}
                      disabled={schemaLoading === type}
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-400 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`w-3 h-3 ${schemaLoading === type ? 'animate-spin' : ''}`} />
                      {schemaLoading === type ? 'Checking…' : 'Check'}
                    </button>
                  </div>

                  {/* Live headers as colour-coded pills */}
                  {liveHeaders.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {liveHeaders.map((h) => {
                        const isExpected = expected.some(f =>
                          h === f ||
                          h.toUpperCase() === f.toUpperCase() ||
                          h.toLowerCase().includes(f.toLowerCase().split(' ')[0])
                        );
                        return (
                          <span
                            key={h}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              isExpected
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                            }`}
                          >
                            {h}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Mismatch warnings */}
                  {mismatches.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {mismatches.map(f => (
                        <p key={f} className="text-[11px] text-amber-400">
                          ⚠ <strong>{f}</strong> not found — column may have been renamed. n8n will still try keyword-matching.
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>

          {/* Personnel Editor */}
          <PersonnelEditor />

          {/* Danger zone */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-2xl p-5 space-y-4">
            <h4 className="text-sm font-semibold text-danger-500 uppercase tracking-wider">Danger Zone</h4>
            <Button variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={handleClearData}>
              Clear All Local Data
            </Button>
          </motion.div>

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
