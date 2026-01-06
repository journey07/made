import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Save, BookOpen, Sliders, Plus, Trash2, ArrowDownWideNarrow } from 'lucide-react';
import { AppConfig, ReferenceItem } from '../types';
import { CriteriaCard } from './CriteriaCard';
import { DEFAULT_CONFIG, extractValuesFromCriteria } from '../utils';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, config, onSave }) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'customize'>('guide');
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);

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

  const handleDefaultValueChange = (key: keyof AppConfig['defaultValues'], val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const validValues = localConfig.ranges[key].values;
    
    // 가장 가까운 유효한 값 찾기
    if (validValues.length === 0) return;
    
    const closest = validValues.reduce((prev, curr) => 
      Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
    );
    
    setLocalConfig(prev => ({
      ...prev,
      defaultValues: { ...prev.defaultValues, [key]: closest }
    }));
  };

  const handleCriteriaChange = (category: keyof AppConfig['criteria'], index: number, field: keyof ReferenceItem, value: string) => {
    const newCriteria = [...localConfig.criteria[category]];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    
    // Criteria 변경 시 자동으로 ranges 업데이트
    const newRanges = {
      ...localConfig.ranges,
      [category]: { values: extractValuesFromCriteria(newCriteria) }
    };
    
    setLocalConfig(prev => ({
      ...prev,
      criteria: { ...prev.criteria, [category]: newCriteria },
      ranges: newRanges
    }));
  };

  const addCriteriaRow = (category: keyof AppConfig['criteria']) => {
    const newCriteria = [...localConfig.criteria[category]];
    newCriteria.push({ range: '', label: 'New Rule', description: '' });
    
    const newRanges = {
      ...localConfig.ranges,
      [category]: { values: extractValuesFromCriteria(newCriteria) }
    };
    
    setLocalConfig(prev => ({
      ...prev,
      criteria: { ...prev.criteria, [category]: newCriteria },
      ranges: newRanges
    }));
  };

  const removeCriteriaRow = (category: keyof AppConfig['criteria'], index: number) => {
    const newCriteria = localConfig.criteria[category].filter((_, i) => i !== index);
    
    const newRanges = {
      ...localConfig.ranges,
      [category]: { values: extractValuesFromCriteria(newCriteria) }
    };
    
    setLocalConfig(prev => ({
      ...prev,
      criteria: { ...prev.criteria, [category]: newCriteria },
      ranges: newRanges
    }));
  };

  const autoSortCriteria = (category: keyof AppConfig['criteria']) => {
    const newCriteria = [...localConfig.criteria[category]].sort((a, b) => {
        const getVal = (str: string) => {
            const match = str.match(/[\d.]+/);
            return match ? parseFloat(match[0]) : 0;
        };
        return getVal(b.range) - getVal(a.range);
    });
    
    const newRanges = {
      ...localConfig.ranges,
      [category]: { values: extractValuesFromCriteria(newCriteria) }
    };
    
    setLocalConfig(prev => ({
        ...prev,
        criteria: { ...prev.criteria, [category]: newCriteria },
        ranges: newRanges
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-zinc-900/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl w-full max-w-5xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden border border-zinc-200">
        
        {/* Header */}
        <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4 sm:gap-10">
            <h2 className="text-lg sm:text-xl font-black text-zinc-900 tracking-tight">Settings</h2>
            <div className="flex bg-zinc-100 p-1 rounded-xl sm:p-1.5 sm:rounded-2xl">
                <button
                    onClick={() => setActiveTab('guide')}
                    className={`flex items-center gap-2 px-3 py-1.5 sm:px-6 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all ${
                        activeTab === 'guide' 
                        ? 'bg-white text-zinc-900 shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                >
                    <BookOpen size={14} className="sm:w-3.5 sm:h-3.5 w-3 h-3" />
                    Guide
                </button>
                <button
                    onClick={() => setActiveTab('customize')}
                    className={`flex items-center gap-2 px-3 py-1.5 sm:px-6 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black transition-all ${
                        activeTab === 'customize' 
                        ? 'bg-white text-zinc-900 shadow-sm' 
                        : 'text-zinc-400 hover:text-zinc-600'
                    }`}
                >
                    <Sliders size={14} className="sm:w-3.5 sm:h-3.5 w-3 h-3" />
                    Customize
                </button>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 sm:p-3 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-full transition-all"
          >
            <X size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-zinc-50/30 p-4 sm:p-8">
            {activeTab === 'guide' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 pb-10">
                    <CriteriaCard title={`Money (x${localConfig.weights.m})`} color="text-emerald-500" items={localConfig.criteria.m} />
                    <CriteriaCard title={`Asset (x${localConfig.weights.a})`} color="text-violet-500" items={localConfig.criteria.a} />
                    <CriteriaCard title="Deadline (Multiplier)" color="text-red-500" items={localConfig.criteria.d} />
                    <CriteriaCard title="Effort (Subtractor)" color="text-amber-500" items={localConfig.criteria.e} />
                </div>
            ) : (
                <div className="max-w-4xl mx-auto space-y-6 sm:space-y-10 pb-20">
                    {/* Weights Section */}
                    <div className="bg-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-zinc-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
                            <h3 className="text-base sm:text-lg font-black text-zinc-900">Formula Weights</h3>
                            <span className="text-[9px] sm:text-[10px] font-black text-zinc-400 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100 uppercase tracking-widest w-fit">
                                Score = (({localConfig.weights.m}M + {localConfig.weights.a}A) × D - E) × 10
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                            <div className="space-y-2 sm:space-y-3">
                                <label className="block text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Money Weight</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={localConfig.weights.m}
                                    onChange={(e) => handleWeightChange('m', e.target.value)}
                                    className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-zinc-50 border border-zinc-100 rounded-xl sm:rounded-2xl text-zinc-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-2 sm:space-y-3">
                                <label className="block text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">Asset Weight</label>
                                <input 
                                    type="number" 
                                    step="0.1"
                                    value={localConfig.weights.a}
                                    onChange={(e) => handleWeightChange('a', e.target.value)}
                                    className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-zinc-50 border border-zinc-100 rounded-xl sm:rounded-2xl text-zinc-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Default values */}
                    <div className="bg-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-zinc-100 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 sm:mb-8">
                            <h3 className="text-base sm:text-lg font-black text-zinc-900">Default Starting Values</h3>
                            <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Initial slider positions</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                            {(['m', 'a', 'd', 'e'] as const).map(key => {
                                const validValues = localConfig.ranges[key].values;
                                const minVal = validValues[0];
                                const maxVal = validValues[validValues.length - 1];
                                const isDecimal = validValues.some(v => v % 1 !== 0);
                                
                                return (
                                <div key={key} className="space-y-2 sm:space-y-3">
                                    <label className="block text-[9px] sm:text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
                                        {key === 'm' ? 'Money' : key === 'a' ? 'Asset' : key === 'd' ? 'Deadline' : 'Effort'}
                                    </label>
                                    <input
                                        type="number"
                                        step={isDecimal ? 0.1 : 1}
                                        min={minVal}
                                        max={maxVal}
                                        value={localConfig.defaultValues[key]}
                                        onChange={(e) => handleDefaultValueChange(key, e.target.value)}
                                        className="w-full px-3 sm:px-4 py-3 sm:py-4 bg-zinc-50 border border-zinc-100 rounded-xl sm:rounded-2xl text-zinc-900 font-bold focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all text-sm sm:text-base"
                                    />
                                    <p className="text-[8px] sm:text-[9px] text-zinc-400 ml-1">Available: {validValues.join(', ')}</p>
                                </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Criteria Section */}
                    <div className="space-y-6 sm:space-y-8">
                        <div className="px-2">
                            <h3 className="text-lg sm:text-xl font-black text-zinc-900">Criteria Rules</h3>
                            <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-1">Customize the labels and descriptions for each MADE level.</p>
                        </div>
                        
                        {(['m', 'a', 'd', 'e'] as const).map((key) => (
                             <div key={key} className="bg-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border border-zinc-100 shadow-sm relative group">
                                <div className="flex items-center justify-between mb-6 sm:mb-8 pb-4 border-b border-zinc-50">
                                    <h4 className="font-black text-zinc-900 uppercase text-[10px] sm:text-xs tracking-[0.2em] flex items-center gap-3">
                                        <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                                            key === 'm' ? 'bg-emerald-500' : 
                                            key === 'a' ? 'bg-violet-500' : 
                                            key === 'd' ? 'bg-red-500' : 'bg-amber-500'
                                        }`} />
                                        {key === 'm' ? 'Money' : key === 'a' ? 'Asset' : key === 'd' ? 'Deadline' : 'Effort'}
                                    </h4>
                                    <button 
                                        onClick={() => autoSortCriteria(key)}
                                        className="text-[9px] sm:text-[10px] font-black text-zinc-400 hover:text-indigo-600 flex items-center gap-2 bg-zinc-50 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border border-zinc-100 transition-all"
                                    >
                                        <ArrowDownWideNarrow size={12} className="sm:w-3.5 sm:h-3.5" /> 
                                        AUTO SORT
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="hidden sm:grid grid-cols-12 gap-4 px-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                        <div className="col-span-2 text-center">Value</div>
                                        <div className="col-span-3">Label</div>
                                        <div className="col-span-6">Description</div>
                                        <div className="col-span-1"></div>
                                    </div>

                                    {localConfig.criteria[key].map((item, idx) => (
                                        <div key={idx} className="flex flex-col sm:grid sm:grid-cols-12 gap-3 sm:gap-4 items-start sm:items-center group/row animate-in slide-in-from-left-2 duration-300 bg-zinc-50/50 sm:bg-transparent p-4 sm:p-0 rounded-2xl sm:rounded-none relative">
                                            <div className="w-full sm:col-span-2 flex items-center gap-2 sm:block">
                                                <label className="sm:hidden text-[9px] font-black text-zinc-400 uppercase tracking-widest w-12">Value</label>
                                                <input
                                                    type="text"
                                                    value={item.range}
                                                    onChange={(e) => handleCriteriaChange(key, idx, 'range', e.target.value)}
                                                    className="w-full sm:w-full text-xs font-bold text-center text-zinc-600 bg-zinc-50 sm:bg-zinc-50 border border-zinc-100 rounded-xl px-2 py-2.5 sm:py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                                />
                                            </div>
                                            <div className="w-full sm:col-span-3 flex items-center gap-2 sm:block">
                                                <label className="sm:hidden text-[9px] font-black text-zinc-400 uppercase tracking-widest w-12">Label</label>
                                                <input 
                                                    type="text"
                                                    value={item.label}
                                                    onChange={(e) => handleCriteriaChange(key, idx, 'label', e.target.value)}
                                                    className="w-full text-xs font-black text-zinc-900 bg-zinc-50 sm:bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
                                                />
                                            </div>
                                            <div className="w-full sm:col-span-6 flex items-start gap-2 sm:block">
                                                <label className="sm:hidden text-[9px] font-black text-zinc-400 uppercase tracking-widest w-12 mt-3">Desc</label>
                                                <textarea 
                                                    value={item.description}
                                                    onChange={(e) => handleCriteriaChange(key, idx, 'description', e.target.value)}
                                                    rows={2}
                                                    className="w-full text-xs font-medium text-zinc-500 bg-zinc-50 sm:bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-2.5 sm:py-3 focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none resize-none transition-all sm:rows-1"
                                                />
                                            </div>
                                            <div className="absolute top-2 right-2 sm:relative sm:top-0 sm:right-0 sm:col-span-1 flex justify-center">
                                                <button 
                                                    onClick={() => removeCriteriaRow(key, idx)}
                                                    className="p-2 text-zinc-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all sm:opacity-0 group-hover/row:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        onClick={() => addCriteriaRow(key)}
                                        className="w-full py-3.5 sm:py-4 flex items-center justify-center gap-3 text-[10px] sm:text-xs font-black text-zinc-400 border-2 border-dashed border-zinc-100 rounded-xl sm:rounded-2xl hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50 transition-all mt-2 sm:mt-4"
                                    >
                                        <Plus size={14} className="sm:w-4 sm:h-4" /> ADD NEW RULE
                                    </button>
                                </div>
                             </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 sm:px-8 sm:py-6 border-t border-zinc-100 bg-white flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
             <button 
                onClick={resetDefaults}
                className="flex items-center gap-2 text-[10px] sm:text-xs font-black text-zinc-400 hover:text-red-600 transition-colors uppercase tracking-widest order-2 sm:order-1"
             >
                <RotateCcw size={14} className="sm:w-4 sm:h-4" />
                Reset Defaults
             </button>
             <div className="flex gap-3 sm:gap-4 w-full sm:w-auto order-1 sm:order-2">
                <button 
                    onClick={onClose}
                    className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-zinc-400 hover:text-zinc-900 rounded-xl sm:rounded-2xl transition-all"
                >
                    Cancel
                </button>
                <button 
                    onClick={saveChanges}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-10 py-3 sm:py-3.5 bg-zinc-900 text-white rounded-[1rem] sm:rounded-[1.25rem] text-xs sm:text-sm font-black shadow-xl shadow-zinc-200 hover:bg-indigo-600 transition-all active:scale-95"
                >
                    <Save size={16} className="sm:w-[18px] sm:h-[18px]" />
                    Save Changes
                </button>
             </div>
        </div>
      </div>
    </div>
  );
};