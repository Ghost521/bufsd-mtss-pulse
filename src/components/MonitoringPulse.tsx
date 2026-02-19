import React from "react";
import type { StudentMonitoring } from "../types";
import { Trend } from "../types";
import { TrendingUp, TrendingDown, Minus, CheckCircle2, ArrowRight, Activity, Zap } from "lucide-react";

interface MonitoringPulseProps {
  students: StudentMonitoring[];
  onStudentClick: (studentName: string) => void;
  onViewAll: () => void;
  subtitle?: string;
}

export const MonitoringPulse: React.FC<MonitoringPulseProps> = ({ students, onStudentClick, onViewAll, subtitle }) => {
  const getTrendIcon = (trend: Trend) => {
    switch (trend) {
      case Trend.UP:
        return <TrendingUp size={12} />;
      case Trend.DOWN:
        return <TrendingDown size={12} />;
      case Trend.STAGNANT:
        return <Minus size={12} />;
      case Trend.MET:
        return <CheckCircle2 size={12} />;
      default:
        return null;
    }
  };

  const getTrendStyles = (trend: Trend) => {
    switch (trend) {
      case Trend.UP:
        return "text-emerald-700 bg-emerald-50 border-emerald-100";
      case Trend.DOWN:
        return "text-rose-700 bg-rose-50 border-rose-100";
      case Trend.STAGNANT:
        return "text-amber-700 bg-amber-50 border-amber-100";
      case Trend.MET:
        return "text-indigo-700 bg-indigo-50 border-indigo-100";
      default:
        return "text-slate-600 bg-slate-50 border-slate-100";
    }
  };

  const getTrendSignal = (trend: Trend) => {
    switch (trend) {
      case Trend.UP:
        return "Improving trajectory";
      case Trend.DOWN:
        return "Needs immediate follow-up";
      case Trend.STAGNANT:
        return "Plateau risk";
      case Trend.MET:
        return "Goal currently met";
      default:
        return "Monitoring signal";
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800">
            <Activity size={16} className="text-indigo-600" />
            Monitoring Queue
          </h3>
          <p className="mt-1 text-xs font-medium text-slate-500">{subtitle ?? "Students currently flagged for progress review."}</p>
        </div>
      </div>

      <div className="flex-1 divide-y divide-slate-50">
        {students.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-500">No students are currently flagged for monitoring.</p>
            <button
              type="button"
              onClick={onViewAll}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
            >
              Review full queue
              <ArrowRight size={13} />
            </button>
          </div>
        ) : (
          students.map((student) => {
            const trendStyle = getTrendStyles(student.trend);
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => onStudentClick(student.name)}
                className="group relative flex w-full items-start gap-3 p-4 text-left transition-all duration-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={`Open monitoring details for ${student.name}`}
              >
                <div className="absolute bottom-0 left-0 top-0 w-1 bg-indigo-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />

                <div className="h-10 w-10 shrink-0 rounded-full border border-slate-200 bg-slate-100 text-center text-xs font-bold text-slate-500 shadow-sm transition-colors group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-600">
                  <span className="inline-flex h-10 items-center justify-center">{student.name.substring(0, 2).toUpperCase()}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-start justify-between">
                    <h4 className="truncate text-sm font-bold text-slate-700 transition-colors group-hover:text-indigo-700">{student.name}</h4>
                    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${trendStyle}`}>
                      {getTrendIcon(student.trend)}
                      <span className="hidden xl:inline">{student.trend}</span>
                    </span>
                  </div>
                  <p className="flex items-center gap-1.5 truncate text-xs text-slate-500 group-hover:text-slate-600">
                    <Zap size={12} className="text-slate-400 group-hover:text-indigo-400" />
                    {student.intervention}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">{getTrendSignal(student.trend)}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 p-3">
        <button
          type="button"
          onClick={onViewAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-transparent py-2.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-slate-200 hover:bg-white hover:text-indigo-600 hover:shadow disabled:cursor-not-allowed disabled:opacity-50"
        >
          Open Monitoring Queue
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
