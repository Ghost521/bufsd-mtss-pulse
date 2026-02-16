
import React from 'react';
import type { StudentMonitoring} from '../types';
import { Trend } from '../types';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, ArrowRight, Activity, Zap } from 'lucide-react';

interface MonitoringPulseProps {
  students: StudentMonitoring[];
  onStudentClick: (studentName: string) => void;
  onViewAll?: () => void;
}

export const MonitoringPulse: React.FC<MonitoringPulseProps> = ({ students, onStudentClick, onViewAll }) => {

  const getTrendIcon = (trend: Trend) => {
    switch (trend) {
      case Trend.UP: return <TrendingUp size={12} />;
      case Trend.DOWN: return <TrendingDown size={12} />;
      case Trend.STAGNANT: return <Minus size={12} />;
      case Trend.MET: return <CheckCircle2 size={12} />;
      default: return null;
    }
  };

  const getTrendStyles = (trend: Trend) => {
     switch (trend) {
      case Trend.UP: return 'text-emerald-700 bg-emerald-50 border-emerald-100';
      case Trend.DOWN: return 'text-rose-700 bg-rose-50 border-rose-100';
      case Trend.STAGNANT: return 'text-amber-700 bg-amber-50 border-amber-100';
      case Trend.MET: return 'text-indigo-700 bg-indigo-50 border-indigo-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                <Activity size={16} className="text-indigo-600" />
                Monitoring Pulse
            </h3>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Live</span>
            <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </div>
        </div>
      </div>

      <div className="flex-1 divide-y divide-slate-50">
        {students.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No active monitoring alerts.</div>
        ) : (
            students.map((student) => {
                const trendStyle = getTrendStyles(student.trend);
                return (
                    <div 
                        key={student.id} 
                        onClick={() => onStudentClick(student.name)}
                        className="p-4 hover:bg-slate-50 transition-all duration-200 cursor-pointer group flex items-start gap-3 relative"
                    >
                        {/* Hover Indicator */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                        {/* Avatar / Initials */}
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-sm">
                            {student.name.substring(0,2).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="text-sm font-bold text-slate-700 truncate group-hover:text-indigo-700 transition-colors">
                                    {student.name}
                                </h4>
                                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${trendStyle}`}>
                                    {getTrendIcon(student.trend)}
                                    <span className="hidden xl:inline">{student.trend}</span>
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1.5 truncate group-hover:text-slate-600">
                                <Zap size={12} className="text-slate-400 group-hover:text-indigo-400" />
                                {student.intervention}
                            </p>
                        </div>
                    </div>
                );
            })
        )}
      </div>

      <div className="p-3 bg-slate-50/50 border-t border-slate-100">
        <button 
          onClick={onViewAll}
          className="w-full py-2.5 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow"
        >
          View All Monitored Cases
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
