import React from 'react';

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  accentColor: string; // Tailwind class map key
  textColor: string;
  onChange: (val: number) => void;
  subLabel?: string;
  displayValue?: number; // Optional override for the number displayed
}

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
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  
  // Map standard tailwind color names to hex for the gradient inline style
  const getColorHex = (colorClass: string) => {
    if (colorClass.includes('emerald')) return '#10b981';
    if (colorClass.includes('violet')) return '#8b5cf6';
    if (colorClass.includes('amber')) return '#f59e0b';
    if (colorClass.includes('red')) return '#ef4444';
    return '#3b82f6';
  };

  const fillHex = getColorHex(accentColor);

  return (
    <div className="mb-2 w-full">
      <div className="flex justify-between items-end mb-3">
        <div>
            <label className={`text-[11px] font-bold ${textColor} uppercase tracking-widest block mb-0.5`}>
            {label}
            </label>
            <p className="text-sm font-medium text-slate-500 min-h-[1.25rem] whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px] sm:max-w-none">
                {subLabel || "Select a value"}
            </p>
        </div>
        <div className={`text-2xl font-mono font-bold tracking-tight tabular-nums ${textColor.replace('700', '600')}`}>
            {displayValue !== undefined ? displayValue : value}
        </div>
      </div>
      
      <div className="relative w-full h-8 flex items-center group touch-none">
        {/* Track Background */}
        <div className="absolute w-full h-2 bg-slate-100 rounded-full overflow-hidden">
             {/* Filled portion */}
             <div 
                className="h-full transition-all duration-75 ease-out"
                style={{ 
                    width: `${percentage}%`,
                    backgroundColor: fillHex
                }}
             />
        </div>

        {/* The actual input - invisible but captures events */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer z-20"
        />

        {/* Custom Thumb (Visual only) */}
        <div 
            className="absolute h-5 w-5 bg-white border border-slate-200 shadow-lg rounded-full pointer-events-none transition-all duration-75 ease-out z-10 flex items-center justify-center transform group-active:scale-110"
            style={{ 
                left: `calc(${percentage}% - 10px)` // center the 20px thumb
            }}
        >
             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: fillHex }}></div>
        </div>
      </div>
    </div>
  );
};