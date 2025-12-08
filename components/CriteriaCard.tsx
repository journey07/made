import React from 'react';
import { ReferenceItem } from '../types';

interface CriteriaCardProps {
  title: string;
  color: string;
  items: ReferenceItem[];
}

export const CriteriaCard: React.FC<CriteriaCardProps> = ({ title, color, items }) => {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
      <h4 className={`font-bold ${color} mb-4 uppercase text-xs tracking-wider border-b border-slate-100 pb-2`}>
        {title}
      </h4>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="flex flex-col text-sm">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-mono font-bold text-slate-700">{item.range}</span>
              <span className="font-semibold text-slate-900">{item.label}</span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};