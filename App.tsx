import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Settings, BarChart2, Pencil, X, Command, ArrowUpRight, History, Layers, Clock, AlignLeft, Undo2, Cloud, CloudOff, RefreshCw, Copy, Check } from 'lucide-react';
import { Task, AppConfig } from './types';
import { calculateMadeSScore, formatScore, getDescription, getLabel, getRelativeDateLabel, DEFAULT_CONFIG } from './utils';
import { SliderInput } from './components/SliderInput';
import { SettingsPanel } from './components/SettingsPanel';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import logo from './logo.png';

const STORAGE_KEY = 'mades-planner-tasks';
const CONFIG_KEY = 'mades-planner-config';
const RECOVERY_KEY = 'mades-recovery-code';

const sanitizeConfig = (rawConfig: any): AppConfig => {
  const weights = {
    ...DEFAULT_CONFIG.weights,
    ...(rawConfig?.weights || {})
  };
  const criteria = {
    m: rawConfig?.criteria?.m || DEFAULT_CONFIG.criteria.m,
    a: rawConfig?.criteria?.a || DEFAULT_CONFIG.criteria.a,
    d: rawConfig?.criteria?.d || DEFAULT_CONFIG.criteria.d,
    e: rawConfig?.criteria?.e || DEFAULT_CONFIG.criteria.e,
  };
  const defaultValues = {
    ...DEFAULT_CONFIG.defaultValues,
    ...(rawConfig?.defaultValues || {})
  };
  return { weights, criteria, defaultValues };
};

const sanitizeTasks = (rawTasks: any): Task[] => {
  if (!Array.isArray(rawTasks)) return [];
  return rawTasks.map((t: any) => ({
    id: t?.id || generateId(),
    title: t?.title || 'Untitled Task',
    description: t?.description || '',
    m: typeof t?.m === 'number' ? t.m : 5,
    a: typeof t?.a === 'number' ? t.a : 4,
    d: typeof t?.d === 'number' ? t.d : 1.5,
    e: typeof t?.e === 'number' ? t.e : 3,
    score: typeof t?.score === 'number' ? t.score : 0,
    completed: !!t?.completed,
    createdAt: typeof t?.createdAt === 'number' ? t.createdAt : Date.now(),
    completedAt:
      typeof t?.completedAt === 'number'
        ? t.completedAt
        : (t?.completed ? (typeof t?.createdAt === 'number' ? t.createdAt : Date.now()) : undefined),
  }));
};

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// 8자리 복구 코드 생성 (헷갈리는 문자 제외)
const generateRecoveryCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => chars[b % chars.length])
    .join('');
};

type TabType = 'queue' | 'history';
type ToastState = { message: string; type: 'success' | 'info'; action?: { label: string; onClick: () => void } } | null;
type SyncStatus = 'idle' | 'loading' | 'synced' | 'saving' | 'error' | 'offline';

export default function App() {
  // Config State
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
        const saved = localStorage.getItem(CONFIG_KEY);
        return saved ? sanitizeConfig(JSON.parse(saved)) : DEFAULT_CONFIG;
    } catch (e) {
        return DEFAULT_CONFIG;
    }
  });

  // Data State
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return sanitizeTasks(parsed);
    } catch (e) {
      console.error("Failed to load tasks", e);
      return [];
    }
  });

  // Sync State (단순화!)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(() => localStorage.getItem(RECOVERY_KEY));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // UI State: Completing Tasks
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [m, setM] = useState(() => config.defaultValues.m ?? DEFAULT_CONFIG.defaultValues.m);
  const [a, setA] = useState(() => config.defaultValues.a ?? DEFAULT_CONFIG.defaultValues.a);
  const [d, setD] = useState(() => config.defaultValues.d ?? DEFAULT_CONFIG.defaultValues.d);
  const [e, setE] = useState(() => config.defaultValues.e ?? DEFAULT_CONFIG.defaultValues.e);
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('queue');
  const [toast, setToast] = useState<ToastState>(null);
  const [showSignature, setShowSignature] = useState(false);
  
  const formRef = useRef<HTMLDivElement>(null);
  const deletedTaskRef = useRef<Task | null>(null);
  const signatureTimerRef = useRef<number | null>(null);
  const tasksRef = useRef(tasks);
  const configRef = useRef(config);

  // Keep refs updated
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  useEffect(() => { configRef.current = config; }, [config]);

  // LocalStorage persistence (fallback)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  // 복구 코드 저장
  useEffect(() => {
    if (recoveryCode) {
      localStorage.setItem(RECOVERY_KEY, recoveryCode);
    } else {
      localStorage.removeItem(RECOVERY_KEY);
    }
  }, [recoveryCode]);

  // ============ Supabase 자동 동기화 ============
  
  // 1) 앱 시작: 복구 코드가 있으면 DB에서 로드, 없으면 새로 생성
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setSyncStatus('offline');
      setIsInitialLoad(false);
      return;
    }

    const initSync = async () => {
      setSyncStatus('loading');
      
      let code = recoveryCode;
      
      // 복구 코드 없으면 새로 생성
      if (!code) {
        code = generateRecoveryCode();
        setRecoveryCode(code);
      }

      try {
        // DB에서 로드 시도
        const { data, error } = await supabase
          .from('planner_data')
          .select('tasks, config')
          .eq('recovery_code', code)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          // 기존 데이터 있음 → 로드
          setTasks(sanitizeTasks(data.tasks));
          setConfig(sanitizeConfig(data.config));
          setSyncStatus('synced');
        } else {
          // 새 복구 코드 → DB에 현재 로컬 상태 저장
          const { error: insertError } = await supabase
            .from('planner_data')
            .insert({
              recovery_code: code,
              tasks: tasksRef.current,
              config: configRef.current,
            });
          
          if (insertError) throw insertError;
          setSyncStatus('synced');
        }
      } catch (err) {
        console.error('Sync init failed:', err);
        setSyncStatus('error');
      } finally {
        setIsInitialLoad(false);
      }
    };

    initSync();
  }, []); // 앱 시작 시 1번만

  // 2) tasks/config 변경 시 → 자동 저장 (디바운스 800ms)
  useEffect(() => {
    if (!supabase || !recoveryCode || isInitialLoad || syncStatus === 'offline') return;

    setSyncStatus('saving');
    
    const handle = window.setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('planner_data')
          .upsert({
            recovery_code: recoveryCode,
            tasks,
            config,
          }, { onConflict: 'recovery_code' });

        if (error) throw error;
        setSyncStatus('synced');
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSyncStatus('error');
      }
    }, 800);

    return () => window.clearTimeout(handle);
  }, [tasks, config, recoveryCode, isInitialLoad]);

  // 복구 코드로 데이터 복원
  const restoreFromCode = async (code: string) => {
    if (!supabase) {
      showToast('Supabase 설정이 필요합니다', 'info');
      return;
    }
    
    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length !== 8) {
      showToast('복구 코드는 8자리입니다', 'info');
      return;
    }

    setSyncStatus('loading');
    
    try {
      const { data, error } = await supabase
        .from('planner_data')
        .select('tasks, config')
        .eq('recovery_code', cleanCode)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setTasks(sanitizeTasks(data.tasks));
        setConfig(sanitizeConfig(data.config));
        setRecoveryCode(cleanCode);
        setSyncStatus('synced');
        setShowRecoveryModal(false);
        setRecoveryInput('');
        showToast('데이터가 복원되었습니다!', 'success');
      } else {
        showToast('해당 코드의 데이터가 없습니다', 'info');
        setSyncStatus('error');
      }
    } catch (err) {
      console.error('Restore failed:', err);
      setSyncStatus('error');
      showToast('복원 실패', 'info');
    }
  };

  // ============ 나머지 로직 (기존과 동일) ============

  // Sync form defaults when configuration changes and form is idle
  useEffect(() => {
    if (editingId) return;
    if (title || description) return;
    setM(config.defaultValues.m ?? DEFAULT_CONFIG.defaultValues.m);
    setA(config.defaultValues.a ?? DEFAULT_CONFIG.defaultValues.a);
    setD(config.defaultValues.d ?? DEFAULT_CONFIG.defaultValues.d);
    setE(config.defaultValues.e ?? DEFAULT_CONFIG.defaultValues.e);
  }, [config.defaultValues, editingId, title, description]);

  // Toast Timer
  useEffect(() => {
    if (toast) {
        const timer = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(timer);
    }
  }, [toast]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        if (title.trim()) {
           document.getElementById('mades-submit-btn')?.click();
        }
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setShowSignature(true);
        if (signatureTimerRef.current) {
          window.clearTimeout(signatureTimerRef.current);
        }
        signatureTimerRef.current = window.setTimeout(() => setShowSignature(false), 3000);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title]);

  const currentScore = useMemo(() => calculateMadeSScore(m, a, d, e, config.weights), [m, a, d, e, config.weights]);

  const showToast = (message: string, type: 'success' | 'info' = 'success', action?: { label: string; onClick: () => void }) => {
      setToast({ message, type, action });
  };

  const handleConfigSave = (newConfig: AppConfig) => {
      setConfig(sanitizeConfig(newConfig));
      showToast("Configuration saved successfully");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    if (editingId) {
        setTasks(prev => prev.map(t => {
            if (t.id === editingId) {
                return { ...t, title, description, m, a, d, e, score: currentScore };
            }
            return t;
        }));
        setEditingId(null);
        showToast("Task updated successfully");
    } else {
        const newTask: Task = {
            id: generateId(),
            title, description, m, a, d, e,
            score: currentScore,
            completed: false,
            createdAt: Date.now(),
            completedAt: undefined,
        };
        setTasks(prev => [...prev, newTask]);
        showToast("Task added to queue");
    }
    
    resetForm();
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setTitle(task.title);
    setDescription(task.description || '');
    setM(task.m);
    setA(task.a);
    setD(task.d);
    setE(task.e);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    resetForm();
  };

  const getTaskTimestamp = (task: Task) => {
    return task.completed ? (task.completedAt ?? task.createdAt) : task.createdAt;
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setM(config.defaultValues.m ?? DEFAULT_CONFIG.defaultValues.m);
    setA(config.defaultValues.a ?? DEFAULT_CONFIG.defaultValues.a);
    setD(config.defaultValues.d ?? DEFAULT_CONFIG.defaultValues.d);
    setE(config.defaultValues.e ?? DEFAULT_CONFIG.defaultValues.e);
  };

  const toggleComplete = (id: string, currentStatus: boolean) => {
    if (!currentStatus) {
      setCompletingIds(prev => new Set(prev).add(id));
      setTimeout(() => {
        setTasks(prev => prev.map(t => {
          if (t.id !== id) return t;
          return { ...t, completed: true, completedAt: Date.now() };
        }));
        setCompletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 700);
    } else {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: false, completedAt: undefined } : t));
    }
  };

  const restoreDeletedTask = () => {
      if (deletedTaskRef.current) {
          setTasks(prev => [...prev, deletedTaskRef.current!]);
          deletedTaskRef.current = null;
          setToast(null);
      }
  };

  const deleteTask = (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (taskToDelete) {
        deletedTaskRef.current = taskToDelete;
        if (editingId === id) cancelEditing();
        setTasks(prev => prev.filter(t => t.id !== id));
        showToast("Task deleted", "info", { label: "Undo", onClick: restoreDeletedTask });
    }
  };
  
  const clearAll = () => {
    if(window.confirm("Are you sure you want to clear all tasks?")) {
        setTasks([]);
        cancelEditing();
        showToast("All tasks cleared");
    }
  }

  const sortedTasks = useMemo(() => {
    const list = activeTab === 'queue' 
        ? tasks.filter(t => !t.completed) 
        : tasks.filter(t => t.completed);

    return list.sort((a, b) => {
       if (activeTab === 'history') {
          return getTaskTimestamp(b) - getTaskTimestamp(a);
       }
       return b.score - a.score;
    });
  }, [tasks, activeTab]);

  // Sync 상태 표시
  const getSyncStatusDisplay = () => {
    switch (syncStatus) {
      case 'loading': return { icon: <RefreshCw size={14} className="animate-spin" />, text: 'Loading...', color: 'text-blue-500' };
      case 'saving': return { icon: <RefreshCw size={14} className="animate-spin" />, text: 'Saving...', color: 'text-amber-500' };
      case 'synced': return { icon: <Cloud size={14} />, text: 'Synced', color: 'text-emerald-500' };
      case 'error': return { icon: <CloudOff size={14} />, text: 'Error', color: 'text-red-500' };
      case 'offline': return { icon: <CloudOff size={14} />, text: 'Offline', color: 'text-slate-400' };
      default: return { icon: <Cloud size={14} />, text: 'Ready', color: 'text-slate-400' };
    }
  };

  const syncDisplay = getSyncStatusDisplay();

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-zinc-900 font-sans selection:bg-indigo-500 selection:text-white pb-32">
      
      {/* Navbar - Cleaner & Floating */}
      <nav className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-zinc-200/50">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-zinc-900 rounded-xl shadow-lg shadow-zinc-900/20">
              <img src={logo} alt="MADE" className="w-6 h-6 object-cover" />
            </div>
            <h1 
              className="text-base font-bold tracking-tight text-zinc-900"
              style={{ fontFamily: "'Tinos', 'Inter', serif" }}
            >
              MADE <span className="text-zinc-400 font-normal mx-1">|</span> <span className="text-zinc-500">Prioritize your time</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div
              className={`hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-zinc-900 text-white text-[10px] font-bold tracking-wider transition-all duration-300 ${
                showSignature ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
              }`}
              style={{ fontFamily: "'Tinos', 'Inter', serif" }}
            >
              BY INJEON ✨
            </div>

            <button 
              onClick={() => setShowRecoveryModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 border ${
                syncStatus === 'synced' ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100' :
                syncStatus === 'saving' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                syncStatus === 'error' ? 'bg-red-50 border-red-100 text-red-600' :
                'bg-zinc-50 border-zinc-100 text-zinc-400'
              }`}
            >
              {syncDisplay.icon}
              <span className="hidden md:inline">{syncDisplay.text}</span>
            </button>

            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-full text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Recovery Modal & Settings Panel */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200 px-6">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                <Cloud size={18} className="text-indigo-500" />
                Cloud Sync
              </h2>
              <button 
                onClick={() => setShowRecoveryModal(false)} 
                className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              {recoveryCode && (
                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">My Recovery Code</label>
                  <div className="relative group">
                    <div className="w-full px-6 py-5 bg-zinc-50 border border-zinc-100 rounded-2xl text-2xl font-mono font-black text-zinc-900 tracking-[0.2em] text-center select-all shadow-inner">
                      {recoveryCode}
                    </div>
                    <button 
                      onClick={() => { 
                        navigator.clipboard.writeText(recoveryCode!); 
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                        showToast('Code copied to clipboard'); 
                      }} 
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all duration-300 shadow-sm flex items-center justify-center ${
                        isCopied ? 'bg-emerald-500 text-white' : 'bg-zinc-900 text-white hover:bg-zinc-800'
                      }`}
                      title="Copy code"
                    >
                      {isCopied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed text-center px-2 font-medium">
                    Keep this code safe. Use it to restore your data if browser cache is cleared.
                  </p>
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-zinc-100">
                <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Restore from code</label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    value={recoveryInput} 
                    onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())} 
                    placeholder="ENTER CODE" 
                    maxLength={8} 
                    className="w-full px-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-lg font-mono font-black text-center tracking-[0.2em] focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner placeholder:text-zinc-200" 
                  />
                  <button 
                    onClick={() => restoreFromCode(recoveryInput)} 
                    disabled={recoveryInput.length !== 8} 
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-30 disabled:shadow-none transition-all transform active:scale-[0.98]"
                  >
                    Restore Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} config={config} onSave={handleConfigSave} />

      <main className="max-w-[1440px] mx-auto px-6 sm:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT: Input Section */}
          <div className="lg:col-span-5 relative" ref={formRef}>
            <div className={`bg-white rounded-2xl p-6 shadow-[0_2px_15px_rgb(0,0,0,0.04)] border border-zinc-100 transition-all duration-500 sticky top-24 ${
                editingId ? 'ring-2 ring-indigo-500/30' : ''
            }`}>
              <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-1 h-5 rounded-full ${editingId ? 'bg-indigo-500' : 'bg-zinc-900'}`}></div>
                    <h2 className="text-lg font-bold text-zinc-900 tracking-tight">{editingId ? "Edit Task" : "New Task"}</h2>
                  </div>
                  {editingId && (
                      <button onClick={cancelEditing} className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"><X size={18} /></button>
                  )}
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What needs to be done?"
                    className="w-full text-xl font-bold bg-transparent border-b border-zinc-100 py-2 placeholder-zinc-300 focus:outline-none focus:border-indigo-500 transition-all duration-300"
                    autoFocus
                  />
                  <textarea
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     placeholder="Add details (optional)"
                     rows={1}
                     className="w-full text-sm font-medium bg-transparent border-b border-zinc-100 py-2 placeholder-zinc-300 focus:outline-none focus:border-indigo-500 transition-all duration-300 resize-none overflow-hidden"
                  />
                </div>

                <div className="space-y-5">
                  <SliderInput 
                    label="Money"
                    value={m} min={1} max={10} step={1} 
                    accentColor="text-emerald-500"
                    textColor="text-emerald-600"
                    onChange={setM} 
                    subLabel={getDescription(m, config.criteria.m)}
                  />
                  <SliderInput 
                    label="Asset"
                    value={a} min={1} max={10} step={1} 
                    accentColor="text-violet-500"
                    textColor="text-violet-600"
                    onChange={setA} 
                    subLabel={getDescription(a, config.criteria.a)}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <SliderInput 
                      label="Deadline" 
                      value={d} min={1.0} max={2.0} step={0.1} 
                      accentColor="text-red-500"
                      textColor="text-red-600"
                      onChange={setD} 
                      subLabel={getDescription(parseFloat(d.toFixed(1)), config.criteria.d)}
                    />
                    <SliderInput 
                      label="Effort" 
                      value={6 - e} min={1} max={5} step={1} 
                      accentColor="text-amber-500"
                      textColor="text-amber-600"
                      onChange={(val) => setE(6 - val)} 
                      displayValue={e}
                      subLabel={getDescription(e, config.criteria.e)}
                    />
                  </div>
                </div>

                <div className="pt-6 flex items-center justify-between gap-4 border-t border-zinc-50 mt-4">
                    <div className="flex flex-col items-start shrink-0">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Priority Score</span>
                      <div className="flex items-baseline gap-0.5">
                          <span className="text-3xl font-black text-zinc-900 tracking-tighter">{formatScore(currentScore)}</span>
                          <span className="text-[10px] font-bold text-zinc-400">PTS</span>
                      </div>
                    </div>
                    <button
                      id="mades-submit-btn"
                      type="submit"
                      disabled={!title}
                      className={`px-10 group rounded-xl py-4 font-bold text-sm shadow-md disabled:opacity-30 disabled:shadow-none transition-all duration-300 flex items-center justify-center gap-2 ${
                          editingId 
                              ? 'bg-indigo-600 text-white shadow-indigo-100' 
                              : 'bg-zinc-900 text-white shadow-zinc-100'
                      }`}
                    >
                      <span>{editingId ? "Update Task" : "Add to Queue"}</span>
                      <div className="flex items-center gap-1 opacity-40 text-[9px] bg-white/20 px-1.5 py-0.5 rounded">
                          <Command size={9} />
                          <span>↵</span>
                      </div>
                    </button>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT: List Section */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* 🎯 MAIN FOCUS AREA: The Rank #1 Task - More Compact & Aligned */}
            {activeTab === 'queue' && sortedTasks.length > 0 && (
              <div className="relative bg-white rounded-2xl border border-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden animate-in slide-in-from-top-2 duration-500 flex">
                {/* 🧬 Mini DNA Sidebar Accent - Full height */}
                <div className="w-1.5 shrink-0 flex flex-col opacity-40">
                  <div style={{ flex: sortedTasks[0].m }} className="bg-emerald-400" />
                  <div style={{ flex: sortedTasks[0].a }} className="bg-violet-400" />
                  <div style={{ flex: sortedTasks[0].d }} className="bg-red-400" />
                  <div style={{ flex: sortedTasks[0].e }} className="bg-amber-400" />
                </div>

                <div className="flex-1 relative">
                  <div className="p-8 pb-16 relative">
                    <div className="absolute top-0 right-0 p-6">
                      <div className="bg-zinc-900 text-white px-4 py-3 rounded-xl flex flex-col items-center justify-center shadow-lg">
                        <span className="text-xl font-black leading-none">{formatScore(sortedTasks[0].score)}</span>
                        <span className="text-[8px] font-black opacity-40 tracking-widest mt-1">MADE</span>
                      </div>
                    </div>
                    
                    <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-100 rounded-full shadow-sm">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                        </span>
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Critical Mission</span>
                      </div>
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] opacity-80 animate-pulse">Execute Now</span>
                    </div>
                      
                      <div className="space-y-1 max-w-xl">
                        <h2 className="text-2xl font-black text-zinc-900 tracking-tight leading-tight">{sortedTasks[0].title}</h2>
                        {sortedTasks[0].description && (
                          <p className="text-sm text-zinc-400 font-medium line-clamp-2 leading-relaxed">
                            {sortedTasks[0].description}
                          </p>
                        )}
                      </div>

                    <div className="flex items-center gap-4 pt-2">
                      <button 
                        onClick={() => toggleComplete(sortedTasks[0].id, false)}
                        className="group flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold text-xs hover:bg-indigo-600 transition-all shadow-md"
                      >
                        <CheckCircle2 size={18} />
                        <span>Complete Task</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => startEditing(sortedTasks[0])}
                          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-900 font-bold text-xs transition-all px-3 py-2 rounded-lg hover:bg-zinc-50"
                        >
                          <Pencil size={14} />
                          <span>Edit</span>
                        </button>
                        <button 
                          onClick={() => deleteTask(sortedTasks[0].id)}
                          className="flex items-center gap-1.5 text-zinc-400 hover:text-red-600 font-bold text-xs transition-all px-3 py-2 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                    </div>
                  </div>

                  {/* 🧬 MADE Bottom Bar with Scores & Labels - Perfectly aligned */}
                  <div className="absolute bottom-0 left-0 right-0 h-10 flex items-center px-8 justify-between bg-zinc-50/80 border-t border-zinc-100/50">
                    <div className="flex gap-8">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Money</span>
                        <span className="text-[11px] font-black text-zinc-900">{sortedTasks[0].m}</span>
                        <span className="text-[9px] font-bold text-zinc-400">{getLabel(sortedTasks[0].m, config.criteria.m)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Asset</span>
                        <span className="text-[11px] font-black text-zinc-900">{sortedTasks[0].a}</span>
                        <span className="text-[9px] font-bold text-zinc-400">{getLabel(sortedTasks[0].a, config.criteria.a)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Deadline</span>
                        <span className="text-[11px] font-black text-zinc-900">x{sortedTasks[0].d.toFixed(1)}</span>
                        <span className="text-[9px] font-bold text-zinc-400">{getLabel(sortedTasks[0].d, config.criteria.d)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Effort</span>
                        <span className="text-[11px] font-black text-zinc-900">-{sortedTasks[0].e}</span>
                        <span className="text-[9px] font-bold text-zinc-400">{getLabel(sortedTasks[0].e, config.criteria.e)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* List Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-1 bg-zinc-100/50 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('queue')}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'queue' 
                            ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/50' 
                            : 'text-zinc-400 hover:text-zinc-600'
                        }`}
                    >
                        <Layers size={14} />
                        Queue
                        <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === 'queue' ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                            {tasks.filter(t => !t.completed).length}
                        </span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'history' 
                            ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/50' 
                            : 'text-zinc-400 hover:text-zinc-600'
                        }`}
                    >
                        <History size={14} />
                        History
                    </button>
                </div>
              
              {tasks.length > 0 && activeTab === 'queue' && (
                  <button onClick={clearAll} className="text-[9px] font-bold text-zinc-300 hover:text-red-400 tracking-widest uppercase transition-colors px-2">Reset Queue</button>
              )}
            </div>

            {/* Tasks Rendering */}
            {sortedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-zinc-100 text-center px-8">
                <div className="w-14 h-14 bg-zinc-50 rounded-xl flex items-center justify-center mb-6 text-zinc-200">
                  <BarChart2 size={28} strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-bold text-zinc-900 mb-1">{activeTab === 'queue' ? "No tasks queued" : "No history yet"}</h3>
                <p className="text-zinc-400 max-w-[200px] text-xs font-medium leading-relaxed">{activeTab === 'queue' ? "Add a task to see it prioritized here." : "Completed tasks will be archived."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedTasks.map((task, index) => {
                  if (activeTab === 'queue' && index === 0) return null;

                  let showDateHeader = false;
                  if (activeTab === 'history') {
                    const prevTask = index > 0 ? sortedTasks[index - 1] : null;
                    const prevDateLabel = prevTask ? getRelativeDateLabel(getTaskTimestamp(prevTask)) : '';
                    const currentDateLabel = getRelativeDateLabel(getTaskTimestamp(task));
                    if (prevDateLabel !== currentDateLabel) showDateHeader = true;
                  }

                  const isCompleting = completingIds.has(task.id);
                  const displayTimestamp = getTaskTimestamp(task);

                  return (
                  <React.Fragment key={task.id}>
                    {showDateHeader && (
                        <div className="pt-6 pb-2 px-4 flex items-center gap-3">
                            <h4 className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{getRelativeDateLabel(getTaskTimestamp(task))}</h4>
                            <div className="h-px bg-zinc-100 flex-grow"></div>
                        </div>
                    )}

                    <div 
                        className={`group relative bg-white rounded-xl p-0.5 transition-all duration-300 ${
                        task.completed 
                          ? 'opacity-60 bg-zinc-50 hover:opacity-100 hover:bg-white hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-200/40 hover:-translate-y-0.5' 
                          : 'hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-200/40 hover:-translate-y-0.5'
                        } ${editingId === task.id ? 'ring-2 ring-indigo-500/50' : 'border border-zinc-100'} ${isCompleting ? 'opacity-0 scale-95' : ''}`}
                    >
                        <div className="p-5 pl-6">
                            <div className="flex items-center gap-5">
                              <button 
                                  onClick={(e) => { e.stopPropagation(); toggleComplete(task.id, task.completed); }}
                                  className={`flex-shrink-0 transition-all duration-300 ${
                                  task.completed || isCompleting ? 'text-emerald-500' : 'text-zinc-200 hover:text-indigo-500'
                                  }`}
                              >
                                  {task.completed || isCompleting ? <CheckCircle2 size={26} className="fill-emerald-50" /> : <Circle size={26} strokeWidth={1.5} />}
                              </button>

                              <div className="flex-grow min-w-0">
                                  <div className="flex justify-between items-center gap-3">
                                      <div className="space-y-1 min-w-0 flex-1">
                                          <h3 className={`text-lg font-bold tracking-tight truncate transition-all ${
                                              task.completed || isCompleting ? 'text-zinc-400 line-through' : 'text-zinc-900'
                                          }`}>{task.title}</h3>
                                          
                                          {/* Task Description - Shown if exists */}
                                          {task.description && (
                                            <p className={`text-xs font-medium line-clamp-1 mb-1 transition-all ${
                                              task.completed || isCompleting ? 'text-zinc-300' : 'text-zinc-400'
                                            }`}>
                                              {task.description}
                                            </p>
                                          )}

                                          <div className="flex items-center gap-4">
                                              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">{new Date(displayTimestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                              
                                              {/* 🧬 Mini DNA Strip: Always visible graphic indicators */}
                                              <div className={`flex gap-2 items-center h-1.5 transition-opacity duration-200 ${!task.completed ? 'group-hover:opacity-0' : 'opacity-40 group-hover:opacity-0'}`}>
                                                <div className="w-24 h-1 bg-zinc-50 rounded-full overflow-hidden">
                                                  <div style={{ width: `${(task.m / 10) * 100}%` }} className="h-full bg-emerald-400" />
                                                </div>
                                                <div className="w-24 h-1 bg-zinc-50 rounded-full overflow-hidden">
                                                  <div style={{ width: `${(task.a / 10) * 100}%` }} className="h-full bg-violet-400" />
                                                </div>
                                                <div className="w-24 h-1 bg-zinc-50 rounded-full overflow-hidden">
                                                  <div style={{ width: `${((task.d - 1) / 1) * 100}%` }} className="h-full bg-red-400" />
                                                </div>
                                                <div className="w-24 h-1 bg-zinc-50 rounded-full overflow-hidden">
                                                  <div style={{ width: `${(task.e / 5) * 100}%` }} className="h-full bg-amber-400" />
                                                </div>
                                              </div>
                                          </div>
                                      </div>
                                      
                                      <div className="flex items-center gap-4 flex-shrink-0">
                                          <div className="flex flex-col items-end">
                                            <span className="text-3xl font-black text-zinc-900 leading-none tracking-tighter">{formatScore(task.score)}</span>
                                            <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mt-1">PTS</span>
                                          </div>
                                          
                                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                              <button onClick={() => startEditing(task)} className="p-1.5 text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-all"><Pencil size={14} /></button>
                                              <button onClick={() => deleteTask(task.id)} className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                                          </div>
                                      </div>
                                  </div>

                                  {/* Hover Detail: Expands on hover (for both Queue and History) */}
                                  <div className={`grid grid-cols-4 gap-4 mt-0 pt-0 overflow-hidden h-0 opacity-0 group-hover:h-auto group-hover:opacity-100 group-hover:mt-4 group-hover:pt-4 group-hover:border-t group-hover:border-zinc-50 transition-all duration-300 ease-out ${task.completed ? 'grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100' : ''}`}>
                                      <div className="flex flex-col">
                                          <div className="flex justify-between items-baseline">
                                              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Money</span>
                                              <span className="text-xs font-black text-zinc-900">{task.m}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-zinc-50 rounded-full overflow-hidden mt-1.5">
                                              <div style={{ width: `${(task.m / 10) * 100}%` }} className="h-full bg-emerald-400" />
                                          </div>
                                          <span className="text-[10px] font-bold text-zinc-400 mt-1.5 truncate">{getLabel(task.m, config.criteria.m)}</span>
                                      </div>
                                      <div className="flex flex-col">
                                          <div className="flex justify-between items-baseline">
                                              <span className="text-[9px] font-black text-violet-500 uppercase tracking-widest">Asset</span>
                                              <span className="text-xs font-black text-zinc-900">{task.a}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-zinc-50 rounded-full overflow-hidden mt-1.5">
                                              <div style={{ width: `${(task.a / 10) * 100}%` }} className="h-full bg-violet-400" />
                                          </div>
                                          <span className="text-[10px] font-bold text-zinc-400 mt-1.5 truncate">{getLabel(task.a, config.criteria.a)}</span>
                                      </div>
                                      <div className="flex flex-col">
                                          <div className="flex justify-between items-baseline">
                                              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Deadline</span>
                                              <span className="text-xs font-black text-zinc-900">x{task.d.toFixed(1)}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-zinc-50 rounded-full overflow-hidden mt-1.5">
                                              <div style={{ width: `${((task.d - 1) / 1) * 100}%` }} className="h-full bg-red-400" />
                                          </div>
                                          <span className="text-[10px] font-bold text-zinc-400 mt-1.5 truncate">{getLabel(task.d, config.criteria.d)}</span>
                                      </div>
                                      <div className="flex flex-col">
                                          <div className="flex justify-between items-baseline">
                                              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Effort</span>
                                              <span className="text-xs font-black text-zinc-900">-{task.e}</span>
                                          </div>
                                          <div className="w-full h-1.5 bg-zinc-50 rounded-full overflow-hidden mt-1.5">
                                              <div style={{ width: `${(task.e / 5) * 100}%` }} className="h-full bg-amber-400" />
                                          </div>
                                          <span className="text-[10px] font-bold text-zinc-400 mt-1.5 truncate">{getLabel(task.e, config.criteria.e)}</span>
                                      </div>
                                  </div>
                              </div>
                            </div>
                        </div>
                    </div>
                  </React.Fragment>
                )})}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-4 bg-zinc-900 text-white rounded-3xl shadow-2xl shadow-zinc-900/40 animate-in slide-in-from-bottom-5 fade-in duration-300">
              <span className="text-sm font-bold tracking-tight">{toast.message}</span>
              {toast.action && (
                  <button onClick={toast.action.onClick} className="text-xs font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center gap-2 border-l border-zinc-700 pl-4">
                      <Undo2 size={14} /> {toast.action.label}
                  </button>
              )}
          </div>
      )}
    </div>
  );
}
