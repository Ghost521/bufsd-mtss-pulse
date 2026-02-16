import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down';
  status?: 'success' | 'warning' | 'danger' | 'neutral';
  icon: LucideIcon;
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  label, 
  value, 
  trend, 
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
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[140px] group">
      <div className="flex justify-between items-start">
        <div className={`p-2 rounded-lg ${statusColors[status]} group-hover:scale-110 transition-transform duration-200`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${statusColors[status]}`}>
            {trend}
          </span>
        )}
      </div>
      
      <div className="mt-3">
        <h3 className="text-2xl font-bold text-slate-800 tracking-tight truncate" title={String(value)}>
          {value}
        </h3>
        <p className="text-xs font-semibold text-slate-500 truncate mt-1" title={label}>
          {label}
        </p>
      </div>
    </div>
  );
};