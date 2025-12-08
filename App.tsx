import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Settings, BarChart2, Pencil, X, Command, ArrowUpRight, History, Layers, Clock, AlignLeft, Undo2 } from 'lucide-react';
import { Task, AppConfig } from './types';
import { calculateMadeSScore, formatScore, getDescription, getLabel, getRelativeDateLabel, DEFAULT_CONFIG } from './utils';
import { SliderInput } from './components/SliderInput';
import { SettingsPanel } from './components/SettingsPanel';
import logo from './logo.png';

const STORAGE_KEY = 'mades-planner-tasks';
const CONFIG_KEY = 'mades-planner-config';

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

type TabType = 'queue' | 'history';
type ToastState = { message: string; type: 'success' | 'info'; action?: { label: string; onClick: () => void } } | null;

export default function App() {
  // Config State
  const [config, setConfig] = useState<AppConfig>(() => {
    try {
        const saved = localStorage.getItem(CONFIG_KEY);
        return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch (e) {
        return DEFAULT_CONFIG;
    }
  });

  // Data State
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map(t => ({
        id: t.id || generateId(),
        title: t.title || "Untitled Task",
        description: t.description || "",
        m: typeof t.m === 'number' ? t.m : 5,
        a: typeof t.a === 'number' ? t.a : 4,
        d: typeof t.d === 'number' ? t.d : 1.5,
        e: typeof t.e === 'number' ? t.e : 3,
        score: typeof t.score === 'number' ? t.score : 0, 
        completed: !!t.completed,
        createdAt: t.createdAt || Date.now()
      })) : [];
    } catch (e) {
      console.error("Failed to load tasks", e);
      return [];
    }
  });

  // UI State: Completing Tasks
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Default values: M=5, A=4, D=1.5, E=3
  const [m, setM] = useState(5);
  const [a, setA] = useState(4);
  const [d, setD] = useState(1.5);
  const [e, setE] = useState(3);
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('queue');
  const [toast, setToast] = useState<ToastState>(null);
  
  const formRef = useRef<HTMLDivElement>(null);
  const deletedTaskRef = useRef<Task | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

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
      // CMD/CTRL + Enter to Submit
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        if (title.trim()) {
           document.getElementById('mades-submit-btn')?.click();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title]);

  const currentScore = useMemo(() => calculateMadeSScore(m, a, d, e, config.weights), [m, a, d, e, config.weights]);

  // Helper Actions
  const showToast = (message: string, type: 'success' | 'info' = 'success', action?: { label: string; onClick: () => void }) => {
      setToast({ message, type, action });
  };

  const handleConfigSave = (newConfig: AppConfig) => {
      setConfig(newConfig);
      showToast("Configuration saved successfully");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    if (editingId) {
        // Update existing
        setTasks(prev => prev.map(t => {
            if (t.id === editingId) {
                return {
                    ...t,
                    title, description, m, a, d, e,
                    score: currentScore
                };
            }
            return t;
        }));
        setEditingId(null);
        showToast("Task updated successfully");
    } else {
        // Create new
        const newTask: Task = {
            id: generateId(),
            title, description, m, a, d, e,
            score: currentScore,
            completed: false,
            createdAt: Date.now(),
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
    
    // Smooth scroll to form
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setM(5);
    setA(4);
    setD(1.5);
    setE(3);
  };

  const toggleComplete = (id: string, currentStatus: boolean) => {
    // If completing (going from false -> true)
    if (!currentStatus) {
      setCompletingIds(prev => new Set(prev).add(id));
      
      // Wait for animation
      setTimeout(() => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
        setCompletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 700);
    } else {
      // If un-completing (from history), do it instantly
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    }
  };

  const restoreDeletedTask = () => {
      if (deletedTaskRef.current) {
          setTasks(prev => [...prev, deletedTaskRef.current!]);
          deletedTaskRef.current = null;
          setToast(null); // Dismiss undo toast
      }
  };

  const deleteTask = (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (taskToDelete) {
        deletedTaskRef.current = taskToDelete;
        if (editingId === id) cancelEditing();
        setTasks(prev => prev.filter(t => t.id !== id));
        
        showToast("Task deleted", "info", {
            label: "Undo",
            onClick: restoreDeletedTask
        });
    }
  };
  
  const clearAll = () => {
    if(window.confirm("Are you sure you want to clear all tasks?")) {
        setTasks([]);
        cancelEditing();
        showToast("All tasks cleared");
    }
  }

  // Sorting Logic
  const sortedTasks = useMemo(() => {
    const list = activeTab === 'queue' 
        ? tasks.filter(t => !t.completed) 
        : tasks.filter(t => t.completed);

    return list.sort((a, b) => {
       if (activeTab === 'history') return b.createdAt - a.createdAt;
       return b.score - a.score;
    });
  }, [tasks, activeTab]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-500 selection:text-white pb-32">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="MADE Framework logo" className="w-9 h-9 rounded-lg shadow-lg shadow-black/20 object-cover" />
            <h1 
              className="text-lg font-bold tracking-tight text-slate-900"
              style={{ fontFamily: "'Playfair Display', 'Inter', sans-serif" }}
            >
              Plan with <span className="text-indigo-600">MADE</span> Framework <span className="italic">by Injeon</span>
            </h1>
          </div>
          
          <button 
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-bold transition-all duration-200 border bg-white border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            >
                <Settings size={18} />
                <span>Settings</span>
            </button>
        </div>
      </nav>

      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        config={config}
        onSave={handleConfigSave}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          
          {/* LEFT: Input Section */}
          <div className="lg:col-span-7 relative" ref={formRef}>
            <div className={`bg-white rounded-[2rem] p-1 shadow-2xl transition-all duration-500 sticky top-24 ${
                editingId 
                    ? 'shadow-indigo-500/20 border-2 border-indigo-500' 
                    : 'shadow-slate-200/50 border border-slate-100'
            }`}>
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        {editingId ? (
                             <div className="w-1.5 h-6 bg-indigo-500 rounded-full animate-pulse"></div>
                        ) : (
                             <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div>
                        )}
                        {editingId ? "Edit Task" : "New Task"}
                    </h2>
                    {editingId && (
                        <button onClick={cancelEditing} className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider flex items-center gap-1">
                            <X size={14} /> Cancel
                        </button>
                    )}
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <div className="group relative">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title</label>
                        <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full text-lg font-medium bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all duration-200"
                        autoFocus
                        />
                    </div>
                    <div className="group relative">
                         <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-1">
                            <AlignLeft size={10} /> Description <span className="text-slate-300 font-normal normal-case tracking-normal">(Optional)</span>
                         </label>
                         <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Add details, context, or notes..."
                            rows={2}
                            className="w-full text-sm font-medium bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all duration-200 resize-none"
                        />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-2">
                    <SliderInput 
                      label={`Money (x${config.weights.m})`}
                      value={m} min={1} max={10} step={1} 
                      accentColor="text-emerald-500"
                      textColor="text-emerald-700"
                      onChange={setM} 
                      subLabel={getDescription(m, config.criteria.m)}
                    />
                    <SliderInput 
                      label={`Asset (x${config.weights.a})`}
                      value={a} min={1} max={10} step={1} 
                      accentColor="text-violet-500"
                      textColor="text-violet-700"
                      onChange={setA} 
                      subLabel={getDescription(a, config.criteria.a)}
                    />
                    <SliderInput 
                      label="Deadline" 
                      value={d} min={1.0} max={2.0} step={0.1} 
                      accentColor="text-red-500"
                      textColor="text-red-700"
                      onChange={setD} 
                      subLabel={getDescription(parseFloat(d.toFixed(1)), config.criteria.d)}
                    />
                    {/* Effort Slider - Inverted Logic visually */}
                    <SliderInput 
                      label="Effort" 
                      value={6 - e} 
                      min={1} max={5} step={1} 
                      accentColor="text-amber-500"
                      textColor="text-amber-700"
                      onChange={(val) => setE(6 - val)} 
                      displayValue={e} // Show actual value (1-5)
                      subLabel={getDescription(e, config.criteria.e)}
                    />
                  </div>

                  {/* Summary & Action */}
                  <div className="flex items-end justify-between pt-6 border-t border-slate-100 mt-8">
                     <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">MADE Score</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black text-slate-900 tracking-tighter">{formatScore(currentScore)}</span>
                            <span className="text-sm font-medium text-slate-400">pts</span>
                        </div>
                     </div>
                     <button
                        id="mades-submit-btn"
                        type="submit"
                        disabled={!title}
                        className={`group rounded-2xl px-8 py-4 font-bold shadow-xl disabled:opacity-50 disabled:shadow-none transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 flex items-center gap-2 ${
                            editingId 
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20' 
                                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                        }`}
                      >
                        {editingId ? (
                            <>
                                <ArrowUpRight size={20} strokeWidth={3} />
                                <span>Update</span>
                            </>
                        ) : (
                            <>
                                <Plus size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
                                <span>Add</span>
                            </>
                        )}
                        <div className="hidden lg:flex ml-2 items-center gap-1 opacity-40 text-[10px] bg-black/20 px-1.5 py-0.5 rounded">
                            <Command size={10} />
                            <span>↵</span>
                        </div>
                      </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* RIGHT: List Section */}
          <div className="lg:col-span-5 space-y-8">
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                <div className="bg-slate-100/80 p-1 rounded-xl inline-flex">
                    <button 
                        onClick={() => setActiveTab('queue')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === 'queue' 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Layers size={16} />
                        Queue
                        <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${activeTab === 'queue' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                            {tasks.filter(t => !t.completed).length}
                        </span>
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === 'history' 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <History size={16} />
                        History
                    </button>
                </div>
              
              {tasks.length > 0 && activeTab === 'queue' && (
                  <button 
                    onClick={clearAll}
                    className="text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors px-2"
                  >
                    Clear All
                  </button>
              )}
            </div>

            {sortedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-100 text-center px-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 text-slate-300">
                  <BarChart2 size={32} strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {activeTab === 'queue' ? "Your queue is empty" : "No history yet"}
                </h3>
                <p className="text-slate-500 max-w-sm text-sm">
                    {activeTab === 'queue' ? "Add tasks to calculate their MADE score and prioritize your day." : "Completed tasks will appear here."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedTasks.map((task, index) => {
                  // Logic to render Date Headers in History View
                  let showDateHeader = false;
                  if (activeTab === 'history') {
                    const prevTask = index > 0 ? sortedTasks[index - 1] : null;
                    const prevDateLabel = prevTask ? getRelativeDateLabel(prevTask.createdAt) : '';
                    const currentDateLabel = getRelativeDateLabel(task.createdAt);
                    if (prevDateLabel !== currentDateLabel) {
                        showDateHeader = true;
                    }
                  }

                  const isQueueTop = activeTab === 'queue' && !task.completed;
                  const isTop1 = isQueueTop && index === 0;
                  const isTop2 = isQueueTop && index === 1;
                  const rankBadgeClass = isTop1
                    ? 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 text-amber-950 ring-amber-200 shadow-amber-500/30'
                    : isTop2
                    ? 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-800 ring-slate-200 shadow-slate-400/30'
                    : 'bg-slate-900 text-white shadow-slate-900/20';

                  const isCompleting = completingIds.has(task.id);

                  return (
                  <React.Fragment key={task.id}>
                    {showDateHeader && (
                        <div className="pt-6 pb-2 px-2 flex items-center gap-4">
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{getRelativeDateLabel(task.createdAt)}</h4>
                            <div className="h-px bg-slate-100 flex-grow"></div>
                        </div>
                    )}

                    <div 
                        className={`group relative bg-white rounded-2xl p-1 transition-all duration-500 ease-out ${
                        task.completed 
                            ? 'opacity-80 bg-slate-50' 
                            : 'shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1'
                        } ${editingId === task.id ? 'ring-2 ring-indigo-500 shadow-lg' : 'border border-slate-100'} ${isCompleting ? 'opacity-0 translate-x-12 scale-95 pointer-events-none' : ''}`}
                    >
                        <div className="p-5 pl-7">
                            {/* Improved Rank Badge */}
                            {!task.completed && !isCompleting && (
                                <div
                                    className={`absolute -left-2 sm:-left-3 top-4 w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full shadow-xl font-black text-xs sm:text-sm z-10 border-2 border-white ring-1 ${rankBadgeClass}`}
                                >
                                    {index + 1}
                                </div>
                            )}

                            <div className="flex items-start gap-4">
                            
                            {/* Checkbox */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); toggleComplete(task.id, task.completed); }}
                                className={`mt-1 flex-shrink-0 transition-all duration-300 ${
                                task.completed || isCompleting
                                    ? 'text-emerald-500 scale-100' 
                                    : 'text-slate-200 hover:text-emerald-500 hover:scale-110 active:scale-95'
                                }`}
                            >
                                {task.completed || isCompleting ? <CheckCircle2 size={24} className="fill-emerald-50" /> : <Circle size={24} strokeWidth={1.5} />}
                            </button>

                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                        <h3 className={`text-base sm:text-lg font-bold leading-tight break-words transition-all duration-300 ${
                                            task.completed || isCompleting ? 'text-slate-500 line-through decoration-slate-300 decoration-2' : 'text-slate-900'
                                        }`}>
                                            {task.title}
                                        </h3>
                                        {task.description && (
                                            <p className={`text-sm leading-relaxed line-clamp-2 ${task.completed || isCompleting ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {task.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-2 pt-1">
                                            <Clock size={12} className="text-slate-300" />
                                            <span className="text-[10px] font-medium text-slate-400">
                                                {new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Score Badge */}
                                    <div className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-colors ${
                                        task.completed 
                                            ? 'bg-slate-100 text-slate-400' 
                                            : 'bg-slate-900 text-white group-hover:bg-indigo-600 transition-colors duration-300'
                                    }`}>
                                        <span className="text-lg font-bold tracking-tight leading-none">{formatScore(task.score)}</span>
                                        <span className="text-[9px] font-bold opacity-60 leading-none mt-1">PTS</span>
                                    </div>
                                </div>

                                {/* Task DNA Bar */}
                                <div className={`w-full flex h-1.5 rounded-full overflow-hidden bg-slate-100 mt-4 transition-opacity ${
                                    isCompleting ? 'opacity-20' : 'opacity-60 group-hover:opacity-100'
                                }`}>
                                    <div style={{ width: `${(task.m / 10) * 100}%` }} className="bg-emerald-400/80" />
                                    <div style={{ width: `${(task.a / 10) * 100}%` }} className="bg-violet-400/80" />
                                    <div style={{ width: `${((task.d - 1) / 1) * 100}%` }} className="bg-red-400/80" />
                                    <div style={{ width: `${(task.e / 5) * 100}%` }} className="bg-amber-400/80" />
                                </div>

                                {/* Expanded Details */}
                                {!task.completed && (
                                    <div className={`flex flex-wrap items-center justify-between mt-3 gap-y-2 transition-opacity duration-300 ${isCompleting ? 'opacity-0' : ''}`}>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500">
                                            <span className="flex items-center gap-1.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                <span className="font-bold text-slate-700">M:{task.m}</span> 
                                                <span className="text-slate-400 max-w-[80px] truncate hidden sm:inline">{getLabel(task.m, config.criteria.m)}</span>
                                            </span>
                                            <span className="flex items-center gap-1.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                                                <span className="font-bold text-slate-700">A:{task.a}</span>
                                                <span className="text-slate-400 max-w-[80px] truncate hidden sm:inline">{getLabel(task.a, config.criteria.a)}</span>
                                            </span>
                                            <span className="flex items-center gap-1.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                                <span className="font-bold text-slate-700">D:{task.d.toFixed(1)}</span>
                                                <span className="text-slate-400 max-w-[80px] truncate hidden sm:inline">{getLabel(task.d, config.criteria.d)}</span>
                                            </span>
                                            <span className="flex items-center gap-1.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                <span className="font-bold text-slate-700">E:{task.e}</span>
                                                <span className="text-slate-400 max-w-[80px] truncate hidden sm:inline">{getLabel(task.e, config.criteria.e)}</span>
                                            </span>
                                        </div>
                                        
                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <button 
                                                onClick={() => startEditing(task)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit Task"
                                            >
                                                <Pencil size={14} strokeWidth={2.5} />
                                            </button>
                                            <button 
                                                onClick={() => deleteTask(task.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Task"
                                            >
                                                <Trash2 size={14} strokeWidth={2.5} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {task.completed && (
                                    <div className="flex justify-end mt-2">
                                        <button 
                                                onClick={() => deleteTask(task.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete Task"
                                            >
                                                <Trash2 size={14} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                )}

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
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-2xl shadow-slate-900/30 animate-in slide-in-from-bottom-5 fade-in duration-300">
              <span className="text-sm font-semibold">{toast.message}</span>
              {toast.action && (
                  <>
                    <div className="w-px h-4 bg-slate-700"></div>
                    <button 
                        onClick={toast.action.onClick}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider flex items-center gap-1"
                    >
                        <Undo2 size={14} />
                        {toast.action.label}
                    </button>
                  </>
              )}
          </div>
      )}
    </div>
  );
}