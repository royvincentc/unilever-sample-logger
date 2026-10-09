import { RefreshCw } from 'lucide-react';
import { usePersonnel } from '../../hooks/usePersonnel';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function PersonnelSync() {
  const { syncing, syncedAt, error, autoSync, setAutoSync, syncPersonnel } = usePersonnel();
  const online = useOnlineStatus();
  return <div className="space-y-2 my-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
        <input type="checkbox" role="switch" checked={autoSync} onChange={event => setAutoSync(event.target.checked)} />
        Sync personnel every 4 hours
      </label>
      <button type="button" className="lab-button secondary" disabled={syncing || !online} aria-busy={syncing} onClick={() => { void syncPersonnel().catch(() => {}); }}>
        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />{syncing ? 'Syncing personnel…' : 'Sync personnel'}
      </button>
    </div>
    <p role="status" className="text-xs text-[var(--text-muted)]">
      {error || (!online ? 'Offline — using saved personnel names.' : syncedAt ? `Last synced: ${new Date(syncedAt).toLocaleString()}` : 'Using default names until the first successful sync.')}
    </p>
    <p className="text-xs text-[var(--text-muted)]">Automatic sync runs while the app is open and catches up when you return.</p>
  </div>;
}
