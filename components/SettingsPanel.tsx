import React, { useState } from 'react';
import { X, RotateCcw, Save, BookOpen, Sliders, Plus, Trash2, ArrowDownWideNarrow } from 'lucide-react';
import { AppConfig, ReferenceItem } from '../types';
import { CriteriaCard } from './CriteriaCard';
import { DEFAULT_CONFIG } from '../utils';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, config, onSave }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'customize'>('guide');
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);

  // Sync local config when prop changes (if needed, though mostly modal usage)
  React.useEffect(() => {
    if (isOpen) {
        setLocalConfig(config);
    }
  }, [isOpen, config]);

  const handleWeightChange = (key: 'm' | 'a', val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setLocalConfig(prev => ({
        ...prev,
        weights: { ...prev.weights, [key]: num }
      }));
    }
  };

  const handleCriteriaChange = (category: keyof AppConfig['criteria'], index: number, field: keyof ReferenceItem, value: string) => {
    const newCriteria = [...localConfig.criteria[category]];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setLocalConfig(prev => ({
      ...prev,
      criteria: { ...prev.criteria, [category]: newCriteria }
    }));
  };

  const addCriteriaRow = (category: keyof AppConfig['criteria']) => {
    const newCriteria = [...localConfig.criteria[category]];
    newCriteria.push({ range: '', label: 'New Rule', description: '' });
    setLocalConfig(prev => ({
      ...prev,
      criteria: { ...prev.criteria, [category]: newCriteria }
    }));
  };

  const removeCriteriaRow = (category: keyof AppConfig['criteria'], index: number) => {
    const newCriteria = localConfig.criteria[category].filter((_, i) => i !== index);
    setLocalConfig(prev => ({
      ...prev,
      criteria: { ...prev.criteria, [category]: newCriteria }
    }));
  };

  const autoSortCriteria = (category: keyof AppConfig['criteria']) => {
    const newCriteria = [...localConfig.criteria[category]].sort((a, b) => {
        // Extract first number from range string for sorting
        const getVal = (str: string) => {
            const match = str.match(/[\d.]+/);
            return match ? parseFloat(match[0]) : 0;
        };
        // Sort descending (High values first usually)
        return getVal(b.range) - getVal(a.range);
    });
    setLocalConfig(prev => ({
        ...prev,
        criteria: { ...prev.criteria, [category]: newCriteria }
    }));
  };

  const saveChanges = () => {
    onSave(localConfig);
    onClose();
  };

  const resetDefaults = () => {
    if (window.confirm('Are you sure you want to reset all weights and descriptions to default?')) {
      setLocalConfig(DEFAULT_CONFIG);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold text-slate-900">Settings</h2>
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('guide')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        activeTab === 'guide' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <BookOpen size={14} />
                    Guide
                </button>
                <button
                    onClick={() => setActiveTab('customize')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        activeTab === 'customize' 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <Sliders size={14} />
                    Customize
                </button>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
            {activeTab === 'guide' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6">
                    <CriteriaCard title={`Money (x${localConfig.weights.m})`} color="text-emerald-600" items={localConfig.criteria.m} />
                    <CriteriaCard title={`Asset (x${localConfig.weights.a})`} color="text-violet-600" items={localConfig.criteria.a} />
                    <CriteriaCard title="Deadline (Multiplier)" color="text-amber-600" items={localConfig.criteria.d} />
                    <CriteriaCard title="Effort (Subtractor)" color="text-red-600" items={localConfig.criteria.e} />
                </div>
            ) : (
                <div className="max-w-4xl mx-auto space-y-8 pb-12">
                    {/* Weights Section */}
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-900">Formula Weights</h3>
                            <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">Score = ({localConfig.weights.m}M + {localConfig.weights.a}A) × D - E</span>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Money Weight</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={localConfig.weights.m}
                                    onChange={(e) => handleWeightChange('m', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Asset Weight</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={localConfig.weights.a}
                                    onChange={(e) => handleWeightChange('a', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Descriptions Section */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                             <div>
                                <h3 className="font-bold text-slate-900">Criteria Configuration</h3>
                                <p className="text-xs text-slate-500 mt-1">Define ranges (e.g. "9-10") or specific values (e.g. "9.5")</p>
                             </div>
                        </div>
                        
                        {(['m', 'a', 'd', 'e'] as const).map((key) => (
                             <div key={key} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm relative group">
                                <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-2">
                                    <h4 className="font-bold text-slate-900 uppercase text-xs tracking-wider flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${
                                            key === 'm' ? 'bg-emerald-500' : 
                                            key === 'a' ? 'bg-violet-500' : 
                                            key === 'd' ? 'bg-amber-500' : 'bg-red-500'
                                        }`} />
                                        {key === 'm' ? 'Money' : key === 'a' ? 'Asset' : key === 'd' ? 'Deadline' : 'Effort'}
                                    </h4>
                                    <button 
                                        onClick={() => autoSortCriteria(key)}
                                        className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded transition-colors"
                                        title="Sort descending"
                                    >
                                        <ArrowDownWideNarrow size={12} /> Auto Sort
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-3 px-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        <div className="col-span-2">Range / Val</div>
                                        <div className="col-span-3">Label (Short)</div>
                                        <div className="col-span-6">Description</div>
                                        <div className="col-span-1 text-right">Action</div>
                                    </div>

                                    {localConfig.criteria[key].map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-3 items-start animate-in fade-in duration-300">
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    value={item.range}
                                                    onChange={(e) => handleCriteriaChange(key, idx, 'range', e.target.value)}
                                                    className="w-full text-xs font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                                                    placeholder="e.g. 1-2"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                 <input 
                                                    type="text"
                                                    value={item.label}
                                                    onChange={(e) => handleCriteriaChange(key, idx, 'label', e.target.value)}
                                                    className="w-full text-xs font-semibold text-slate-900 border border-slate-200 rounded px-2 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                                    placeholder="Label"
                                                />
                                            </div>
                                            <div className="col-span-6">
                                                <textarea 
                                                    value={item.description}
                                                    onChange={(e) => handleCriteriaChange(key, idx, 'description', e.target.value)}
                                                    rows={1}
                                                    className="w-full text-xs text-slate-600 border border-slate-200 rounded px-2 py-2 focus:ring-2 focus:ring-indigo-500 outline-none resize-none min-h-[34px] leading-relaxed"
                                                    placeholder="Description"
                                                />
                                            </div>
                                            <div className="col-span-1 flex justify-end pt-1">
                                                <button 
                                                    onClick={() => removeCriteriaRow(key, idx)}
                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                    title="Remove row"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        onClick={() => addCriteriaRow(key)}
                                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 border border-dashed border-slate-200 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all mt-2"
                                    >
                                        <Plus size={14} /> Add Criteria Rule
                                    </button>
                                </div>
                             </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
             <button 
                onClick={resetDefaults}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
             >
                <RotateCcw size={14} />
                Reset Defaults
             </button>
             <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={saveChanges}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold shadow-lg shadow-slate-900/10 transition-transform active:scale-95"
                >
                    <Save size={16} />
                    Save Configuration
                </button>
             </div>
        </div>
      </div>
    </div>
  );
};