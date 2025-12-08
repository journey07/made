import React, { useMemo, useState } from 'react';

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  accentColor: string; // e.g. "text-emerald-500"
  textColor: string;
  onChange: (val: number) => void;
  subLabel?: string;
  displayValue?: number; // Optional override for the number displayed
}

const getColorConfig = (colorClass: string) => {
  if (colorClass.includes('emerald')) {
    return {
      from: 'from-emerald-400',
      to: 'to-emerald-500',
      thumb: 'bg-emerald-500',
      ring: 'ring-emerald-500/20',
      glow: 'shadow-emerald-500/30'
    };
  }
  if (colorClass.includes('violet')) {
    return {
      from: 'from-violet-400',
      to: 'to-violet-500',
      thumb: 'bg-violet-500',
      ring: 'ring-violet-500/20',
      glow: 'shadow-violet-500/30'
    };
  }
  if (colorClass.includes('amber')) {
    return {
      from: 'from-amber-400',
      to: 'to-amber-500',
      thumb: 'bg-amber-500',
      ring: 'ring-amber-500/20',
      glow: 'shadow-amber-500/30'
    };
  }
  if (colorClass.includes('red')) {
    return {
      from: 'from-red-400',
      to: 'to-red-500',
      thumb: 'bg-red-500',
      ring: 'ring-red-500/20',
      glow: 'shadow-red-500/30'
    };
  }
  return {
    from: 'from-blue-400',
    to: 'to-blue-500',
    thumb: 'bg-blue-500',
    ring: 'ring-blue-500/20',
    glow: 'shadow-blue-500/30'
  };
};

export const SliderInput: React.FC<SliderInputProps> = ({
  label,
  value,
  min,
  max,
  step,
  accentColor, 
  textColor,
  onChange,
  subLabel,
  displayValue
}) => {
  const [isDragging, setIsDragging] = useState(false);
  
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const colors = getColorConfig(accentColor);

  return (
    <div className="mb-4 w-full group/slider select-none">
      {/* Label Row */}
      <div className="flex justify-between items-end mb-4 px-1">
        <div>
            <label className={`text-[10px] font-bold ${textColor} uppercase tracking-widest block mb-1.5 flex items-center gap-2`}>
              {label}
            </label>
            <p className="text-sm font-medium text-slate-500 h-5 leading-5 overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px] transition-colors duration-300 group-hover/slider:text-slate-700">
                {subLabel || "Select a value"}
            </p>
        </div>
        <div className={`text-3xl font-mono font-black tracking-tighter tabular-nums transition-all duration-300 transform origin-right ${isDragging ? `scale-110 ${textColor}` : 'text-slate-900'}`}>
            {displayValue !== undefined ? displayValue : value}
        </div>
      </div>
      
      {/* Slider Container */}
      <div className="relative w-full h-8 flex items-center touch-none">
        
        {/* Input (Invisible but interactive) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer z-30"
        />

        {/* Track */}
        <div className="absolute w-full h-1 bg-slate-100 rounded-full shadow-sm overflow-visible">
             {/* Filled Progress */}
             <div 
                className={`absolute h-full rounded-full transition-all duration-150 ease-out bg-gradient-to-r ${colors.from} ${colors.to} opacity-80`}
                style={{ width: `${percentage}%` }}
             />
        </div>

        {/* Thumb - Wide Pill / Capsule Style */}
        <div 
            className={`absolute top-1/2 -translate-y-1/2 w-12 h-6 bg-white rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.12)] border border-slate-200/80 pointer-events-none transition-all duration-150 ease-out z-20 flex items-center justify-center gap-1
                ${isDragging ? 'scale-105 ring-3' : 'group-hover/slider:scale-105 ring-2'}
                ${colors.ring}
            `}
            style={{ 
                left: `calc(${percentage}% - 24px)` // Center the 48px thumb
            }}
        >
             {/* Grip Lines */}
             <div className={`w-0.5 h-2.5 rounded-full ${isDragging ? colors.thumb : 'bg-slate-300'} transition-colors duration-200`} />
             <div className={`w-0.5 h-2.5 rounded-full ${isDragging ? colors.thumb : 'bg-slate-300'} transition-colors duration-200`} />
             <div className={`w-0.5 h-2.5 rounded-full ${isDragging ? colors.thumb : 'bg-slate-300'} transition-colors duration-200`} />
        </div>
      </div>
    </div>
  );
};
