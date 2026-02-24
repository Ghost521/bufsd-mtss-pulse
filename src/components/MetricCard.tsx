import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down';
  metricWindow?: string;
  metricBaseline?: string;
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  icon: LucideIcon;
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  label, 
  value, 
  trend, 
  trendDirection,
  metricWindow,
  metricBaseline,
  status = 'neutral',
  icon: Icon
}) => {
  
  const statusColors = {
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    danger: 'text-rose-600 bg-rose-50',
    neutral: 'text-slate-600 bg-slate-100',
  };

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 shadow-sm border border-slate-200/50 hover:shadow-md hover:border-indigo-200/50 transition-all duration-300 flex flex-col justify-between min-h-[160px] group relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-emerald-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-2.5 rounded-xl ${statusColors[status]} group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
          <Icon size={20} strokeWidth={2.5} />
        </div>
        {trend && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-md whitespace-nowrap shadow-sm border border-white/50 ${statusColors[status]}`}>
            {trendDirection === 'up' ? <ArrowUpRight size={12} strokeWidth={3} /> : null}
            {trendDirection === 'down' ? <ArrowDownRight size={12} strokeWidth={3} /> : null}
            {trend}
          </span>
        )}
      </div>
      
      <div className="mt-4 relative z-10">
        <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight truncate" title={String(value)}>
          {value}
        </h3>
        <p className="text-sm font-bold text-slate-500 truncate mt-1 tracking-wide" title={label}>
          {label}
        </p>
        {metricWindow || metricBaseline ? (
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400 truncate uppercase tracking-widest" title={[metricWindow, metricBaseline].filter(Boolean).join(" | ")}>
            {[metricWindow, metricBaseline].filter(Boolean).join(" | ")}
          </p>
        ) : null}
      </div>
    </div>
  );
};
