import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Save, Wifi, WifiOff, Trash2 } from 'lucide-react';
import Header from '../components/Layout/Header';
import TextInput from '../components/ui/TextInput';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { getSettings, saveSettings } from '../utils/auth';
import { testWebhookConnection } from '../utils/api';
import { clearHistory, clearQueue } from '../utils/db';
import { SPREADSHEETS } from '../data/constants';

interface Props {
  theme: 'light' | 'dark' | 'system';
  onSetTheme: (t: 'light' | 'dark' | 'system') => void;
}

export default function Settings({ theme, onSetTheme }: Props) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(getSettings());
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});

  useEffect(() => { setSettings(getSettings()); }, []);

  const handleSave = () => {
    saveSettings(settings);
    showToast('success', 'Settings Saved');
  };

  const handleTest = async (key: 'envi' | 'water' | 'rawmats') => {
    const url = settings.webhookUrls[key];
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

  const webhookFields: { key: 'envi' | 'water' | 'rawmats'; label: string }[] = [
    { key: 'envi', label: 'ENVI Webhook URL' },
    { key: 'water', label: 'WATER Webhook URL' },
    { key: 'rawmats', label: 'RawMats Webhook URL' },
  ];

  return (
    <div>
      <Header theme={theme} onSetTheme={onSetTheme} title="Settings" />
      <div className="px-4 lg:px-8 max-w-2xl space-y-6">
        {/* Webhooks */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">n8n Webhooks</h4>
          {webhookFields.map((f) => (
            <div key={f.key} className="space-y-2">
              <TextInput
                label={f.label}
                value={settings.webhookUrls[f.key]}
                onChange={(v) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, [f.key]: v } })}
                placeholder="https://your-n8n.com/webhook/..."
              />
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" loading={testing === f.key} onClick={() => handleTest(f.key)}
                  icon={testResults[f.key] === true ? <Wifi className="w-3 h-3" /> : testResults[f.key] === false ? <WifiOff className="w-3 h-3" /> : undefined}>
                  Test
                </Button>
                {testResults[f.key] === true && <span className="text-xs text-success-500">✓ Connected</span>}
                {testResults[f.key] === false && <span className="text-xs text-danger-500">✗ Unreachable</span>}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Sheet ID */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Google Sheet</h4>
          
          <div className="flex p-1 bg-[var(--bg-input)] rounded-xl border border-[var(--border-subtle)]">
            <button
              onClick={() => setSettings({ ...settings, spreadsheetId: SPREADSHEETS.practice })}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                settings.spreadsheetId === SPREADSHEETS.practice
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Practice Sheet
            </button>
            <button
              onClick={() => setSettings({ ...settings, spreadsheetId: SPREADSHEETS.official })}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                settings.spreadsheetId === SPREADSHEETS.official
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Official Sheet
            </button>
          </div>

          <TextInput label="Custom Spreadsheet ID" value={settings.spreadsheetId} onChange={(v) => setSettings({ ...settings, spreadsheetId: v })} />
          <p className="text-xs text-[var(--text-muted)] italic">
            Currently using: {settings.spreadsheetId === SPREADSHEETS.practice ? 'Practice Mode' : settings.spreadsheetId === SPREADSHEETS.official ? 'Production Mode' : 'Custom ID'}
          </p>
        </motion.div>

        {/* PIN */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Security</h4>
          <TextInput label="8-Digit PIN" value={settings.pin} onChange={(v) => setSettings({ ...settings, pin: v.replace(/\D/g, '').slice(0, 8) })} placeholder="Enter 8-digit PIN" />
        </motion.div>

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
      </div>
    </div>
  );
}
