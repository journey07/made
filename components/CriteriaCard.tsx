import React from 'react';
import { ReferenceItem } from '../types';

interface CriteriaCardProps {
  title: string;
  color: string;
  items: ReferenceItem[];
}

export const CriteriaCard: React.FC<CriteriaCardProps> = ({ title, color, items }) => {
  return (
    <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
      <h4 className={`font-black ${color} mb-6 uppercase text-[10px] tracking-[0.2em] border-b border-zinc-50 pb-3`}>
        {title}
      </h4>
      <div className="space-y-5">
        {items.map((item, idx) => (
          <div key={idx} className="flex flex-col text-sm group">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="font-bold text-zinc-400 group-hover:text-zinc-600 transition-colors">{item.range}</span>
              <span className="font-black text-zinc-900">{item.label}</span>
            </div>
            <p className="text-zinc-400 font-medium text-xs leading-relaxed group-hover:text-zinc-500 transition-colors">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};