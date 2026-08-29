import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Search, RefreshCw, Key, Shield, AlertCircle, X, ChevronRight, Check, CheckCircle2, ChevronDown } from 'lucide-react';
import Header from '../components/Layout/Header';
import { useTheme } from '../hooks/useTheme';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

// 5 minutes in milliseconds
const PASSWORD_VALIDITY_MS = 5 * 60 * 1000;
const EDITOR_PASSWORD = 'admin'; // Simple default password for demonstration

export default function LiveSheetView() {
  const { theme, setTheme } = useTheme();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [passwordPromptVisible, setPasswordPromptVisible] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [lastAuthTime, setLastAuthTime] = useState<number>(() => {
    const saved = localStorage.getItem('supabaseEditorAuthTime');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);
  
  const isOnline = useOnlineStatus();

  const loadData = useCallback(async () => {
    if (!isOnline) {
      setError('You are currently offline.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/supabase-samples?limit=200`);
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      setData(rows || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data from Supabase.');
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cleanup auth on unmount or interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastAuthTime > 0 && Date.now() - lastAuthTime > PASSWORD_VALIDITY_MS) {
        setLastAuthTime(0); // Expire
        localStorage.removeItem('supabaseEditorAuthTime');
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [lastAuthTime]);

  const handleCellDoubleClick = (id: string, field: string, currentValue: any) => {
    if (Date.now() - lastAuthTime < PASSWORD_VALIDITY_MS) {
      // Authorized
      let valToEdit = currentValue;
      if (typeof currentValue === 'object') {
        valToEdit = JSON.stringify(currentValue, null, 2);
      } else {
        valToEdit = String(currentValue || '');
      }
      setEditValue(valToEdit);
      setEditingCell({ id, field });
    } else {
      // Prompt password
      setPasswordPromptVisible(true);
      setPasswordError('');
      setPasswordInput('');
    }
  };

  const submitPassword = () => {
    if (passwordInput === EDITOR_PASSWORD) {
      const now = Date.now();
      setLastAuthTime(now);
      localStorage.setItem('supabaseEditorAuthTime', now.toString());
      setPasswordPromptVisible(false);
    } else {
      setPasswordError('Invalid password');
    }
  };

  const saveCellEdit = async () => {
    if (!editingCell) return;
    
    // Check auth again just in case
    if (Date.now() - lastAuthTime > PASSWORD_VALIDITY_MS) {
      setEditingCell(null);
      setPasswordPromptVisible(true);
      return;
    }

    const { id, field } = editingCell;
    setSavingId(id);
    
    let parsedValue = editValue;
    if (field === 'sheet_data') {
      try {
        parsedValue = JSON.parse(editValue);
      } catch (e) {
        alert('Invalid JSON format for sheet_data');
        setSavingId(null);
        return;
      }
    }

    try {
      const response = await fetch('/api/supabase-samples', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: parsedValue }),
      });
      
      if (!response.ok) throw new Error(await response.text());
      const updatedRow = await response.json();
      
      // Update local state
      setData(prev => prev.map(row => row.id === id ? { ...row, ...updatedRow } : row));
      setEditingCell(null);
    } catch (err: any) {
      alert(`Error saving: ${err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const query = searchQuery.toLowerCase();
      const ctrl = String(row.control_number || '').toLowerCase();
      const name = String(row.sample_name || '').toLowerCase();
      const type = String(row.sample_type || '').toLowerCase();
      return ctrl.includes(query) || name.includes(query) || type.includes(query);
    });
  }, [data, searchQuery]);

  return (
    <div className="h-screen flex flex-col bg-[#1c1c1c] text-[#ededed] font-sans overflow-hidden">
      <Header theme="dark" onSetTheme={() => {}} title="Supabase Table Editor" />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-[#3e3e3e] bg-[#1a1a1a] flex flex-col">
          <div className="p-4 border-b border-[#3e3e3e]">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#2a2a2a] rounded text-sm text-[#ededed] cursor-pointer hover:bg-[#333]">
              <Database className="w-4 h-4 text-emerald-500" />
              <span>Project Editor</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-xs font-bold text-[#888] px-2 py-2 uppercase tracking-wider">Tables</div>
            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#2a2a2a] border border-[#3e3e3e] rounded text-sm cursor-pointer text-emerald-400 font-medium">
              <ChevronRight className="w-4 h-4" />
              public.samples
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          {/* Top Bar */}
          <div className="h-14 border-b border-[#3e3e3e] flex items-center justify-between px-4 bg-[#1e1e1e] shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-[#888]" />
                <span className="text-[#888]">public</span>
                <span className="text-[#888]">/</span>
                <span className="font-medium">samples</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#888]" />
                <input
                  type="text"
                  placeholder="Filter by id, control_number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#2a2a2a] border border-[#3e3e3e] rounded py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:border-[#666] w-64 placeholder-[#666] text-[#ededed]"
                />
              </div>
              <button 
                onClick={loadData}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] border border-[#3e3e3e] rounded text-xs hover:bg-[#333] transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <div className="h-4 w-px bg-[#3e3e3e]"></div>
              <button className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors">
                Insert
              </button>
              {Date.now() - lastAuthTime < PASSWORD_VALIDITY_MS && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs border border-emerald-500/30" title="Edit Session Active">
                  <Key className="w-3 h-3" /> Active
                </div>
              )}
            </div>
          </div>

          {/* Table Area */}
          <div className="flex-1 overflow-auto bg-[#1a1a1a] relative">
            {error && (
              <div className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center">
                <div className="bg-[#2a2a2a] border border-red-500/30 p-4 rounded-lg flex items-center gap-3 text-red-400 max-w-md">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                  <button onClick={() => setError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}
            
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#222] z-10 border-b border-[#3e3e3e] shadow-sm">
                <tr>
                  <th className="px-3 py-2 border-r border-[#3e3e3e] w-10 text-center font-normal text-[#888]">
                    <input type="checkbox" className="accent-emerald-500 rounded-sm bg-[#1a1a1a] border-[#3e3e3e]" />
                  </th>
                  <th className="px-4 py-2 border-r border-[#3e3e3e] font-medium text-[#ededed] whitespace-nowrap group">
                    <div className="flex items-center gap-2">
                      <span className="text-[#888] font-mono text-[10px]">text</span>
                      control_number
                    </div>
                  </th>
                  <th className="px-4 py-2 border-r border-[#3e3e3e] font-medium text-[#ededed] whitespace-nowrap group">
                    <div className="flex items-center gap-2">
                      <span className="text-[#888] font-mono text-[10px]">text</span>
                      sample_name
                    </div>
                  </th>
                  <th className="px-4 py-2 border-r border-[#3e3e3e] font-medium text-[#ededed] whitespace-nowrap group">
                    <div className="flex items-center gap-2">
                      <span className="text-[#888] font-mono text-[10px]">text</span>
                      sample_type
                    </div>
                  </th>
                  <th className="px-4 py-2 border-r border-[#3e3e3e] font-medium text-[#ededed] whitespace-nowrap group">
                    <div className="flex items-center gap-2">
                      <span className="text-[#888] font-mono text-[10px]">jsonb</span>
                      sheet_data
                    </div>
                  </th>
                  <th className="px-4 py-2 font-medium text-[#ededed] whitespace-nowrap group">
                    <div className="flex items-center gap-2">
                      <Key className="w-3 h-3 text-amber-500" />
                      <span className="text-[#888] font-mono text-[10px]">uuid</span>
                      id
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3e3e3e] font-mono text-[#ccc]">
                {loading && data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#888]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading samples...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[#888]">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row) => (
                    <tr key={row.id} className="hover:bg-[#2a2a2a] group transition-colors">
                      <td className="px-3 py-1.5 border-r border-[#3e3e3e] text-center border-l-2 border-l-transparent group-hover:border-l-emerald-500">
                        <input type="checkbox" className="accent-emerald-500 rounded-sm bg-[#1a1a1a] border-[#3e3e3e]" />
                      </td>
                      
                      {/* control_number */}
                      <td 
                        className={`px-4 py-1.5 border-r border-[#3e3e3e] truncate max-w-[150px] cursor-cell ${editingCell?.id === row.id && editingCell?.field === 'control_number' ? 'p-0' : ''}`}
                        onDoubleClick={() => handleCellDoubleClick(row.id, 'control_number', row.control_number)}
                      >
                        {editingCell?.id === row.id && editingCell?.field === 'control_number' ? (
                          <input 
                            autoFocus
                            className="w-full h-full bg-[#1a1a1a] text-white px-4 py-1.5 outline-none border-2 border-emerald-500"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveCellEdit}
                            onKeyDown={e => { if (e.key === 'Enter') saveCellEdit(); else if (e.key === 'Escape') setEditingCell(null); }}
                          />
                        ) : row.control_number}
                      </td>

                      {/* sample_name */}
                      <td 
                        className={`px-4 py-1.5 border-r border-[#3e3e3e] truncate max-w-[200px] cursor-cell ${editingCell?.id === row.id && editingCell?.field === 'sample_name' ? 'p-0' : ''}`}
                        onDoubleClick={() => handleCellDoubleClick(row.id, 'sample_name', row.sample_name)}
                      >
                        {editingCell?.id === row.id && editingCell?.field === 'sample_name' ? (
                          <input 
                            autoFocus
                            className="w-full h-full bg-[#1a1a1a] text-white px-4 py-1.5 outline-none border-2 border-emerald-500"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveCellEdit}
                            onKeyDown={e => { if (e.key === 'Enter') saveCellEdit(); else if (e.key === 'Escape') setEditingCell(null); }}
                          />
                        ) : row.sample_name}
                      </td>

                      {/* sample_type */}
                      <td 
                        className={`px-4 py-1.5 border-r border-[#3e3e3e] truncate max-w-[100px] cursor-cell ${editingCell?.id === row.id && editingCell?.field === 'sample_type' ? 'p-0' : ''}`}
                        onDoubleClick={() => handleCellDoubleClick(row.id, 'sample_type', row.sample_type)}
                      >
                        {editingCell?.id === row.id && editingCell?.field === 'sample_type' ? (
                          <input 
                            autoFocus
                            className="w-full h-full bg-[#1a1a1a] text-white px-4 py-1.5 outline-none border-2 border-emerald-500"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveCellEdit}
                            onKeyDown={e => { if (e.key === 'Enter') saveCellEdit(); else if (e.key === 'Escape') setEditingCell(null); }}
                          />
                        ) : row.sample_type}
                      </td>

                      {/* sheet_data */}
                      <td 
                        className={`px-4 py-1.5 border-r border-[#3e3e3e] truncate max-w-[300px] cursor-cell ${editingCell?.id === row.id && editingCell?.field === 'sheet_data' ? 'p-0' : ''}`}
                        onDoubleClick={() => handleCellDoubleClick(row.id, 'sheet_data', row.sheet_data)}
                      >
                        {editingCell?.id === row.id && editingCell?.field === 'sheet_data' ? (
                          <div className="relative">
                            <textarea 
                              autoFocus
                              className="w-full h-24 bg-[#1a1a1a] text-[#emerald-300] px-2 py-1 outline-none border-2 border-emerald-500 font-mono text-[10px] resize-y"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={saveCellEdit}
                              onKeyDown={e => { if (e.key === 'Escape') setEditingCell(null); }}
                            />
                            <div className="absolute top-1 right-1 text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded">JSONB</div>
                          </div>
                        ) : (
                          <span className="text-[#a5d6ff]">
                            {JSON.stringify(row.sheet_data)}
                          </span>
                        )}
                      </td>

                      {/* id */}
                      <td className="px-4 py-1.5 truncate max-w-[200px] text-[#888]">
                        {row.id}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer status bar */}
          <div className="h-8 border-t border-[#3e3e3e] bg-[#1e1e1e] flex items-center px-4 justify-between shrink-0 text-[11px] text-[#888]">
            <div className="flex items-center gap-4">
              <span>{filteredData.length} records</span>
              {savingId && <span className="flex items-center gap-1.5 text-emerald-500"><RefreshCw className="w-3 h-3 animate-spin" /> Saving...</span>}
            </div>
            <div className="flex items-center gap-2">
              <span>Data fetched from Supabase</span>
            </div>
          </div>
        </div>
      </div>

      {/* Password Prompt Modal */}
      <AnimatePresence>
        {passwordPromptVisible && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1e1e1e] border border-[#3e3e3e] rounded-xl shadow-2xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-5 border-b border-[#3e3e3e] flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Authentication Required</h3>
                  <p className="text-xs text-[#888]">Enter editor password to modify data</p>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {passwordError && (
                  <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-medium">
                    {passwordError}
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#ccc]">Password</label>
                  <input
                    type="password"
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
                    className="w-full bg-[#1a1a1a] border border-[#3e3e3e] rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none transition-colors"
                    placeholder="Enter password..."
                  />
                  <p className="text-[10px] text-[#888] pt-1">Session remains valid for 5 minutes.</p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button 
                    onClick={() => setPasswordPromptVisible(false)}
                    className="px-4 py-2 text-xs font-medium text-[#aaa] hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={submitPassword}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    Authenticate
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
