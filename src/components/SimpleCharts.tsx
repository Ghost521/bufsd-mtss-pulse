import React from 'react';

type BarDatum = {
  name: string;
  value: number;
  fill: string;
};

type DonutDatum = {
  name: string;
  value: number;
  color: string;
};

type SimpleBarChartProps = {
  data: BarDatum[];
  className?: string;
};

type SimpleDonutChartProps = {
  data: DonutDatum[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  className?: string;
};

export function SimpleBarChart({ data, className = '' }: SimpleBarChartProps) {
  const maxValue = Math.max(1, ...data.map((entry) => entry.value));
  const total = Math.max(1, data.reduce((sum, entry) => sum + entry.value, 0));

  return (
    <div className={`grid h-full min-h-[224px] grid-cols-3 items-end gap-4 ${className}`}>
      {data.map((entry) => {
        const heightPercent = Math.max(12, Math.round((entry.value / maxValue) * 100));
        const percent = Math.round((entry.value / total) * 100);

        return (
          <div key={entry.name} className="flex h-full min-w-0 flex-col items-center justify-end gap-3">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">{entry.value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{percent}% of total</p>
            </div>
            <div className="flex h-full w-full items-end justify-center rounded-t-2xl bg-slate-50/80 px-3 pb-0">
              <div
                className="w-full rounded-t-2xl shadow-sm transition-[height] duration-500"
                style={{ height: `${heightPercent}%`, backgroundColor: entry.fill }}
                title={`${entry.name}: ${entry.value} students (${percent}%)`}
                aria-label={`${entry.name}: ${entry.value} students (${percent} percent)`}
              />
            </div>
            <p className="text-center text-xs font-semibold text-slate-600">{entry.name}</p>
          </div>
        );
      })}
    </div>
  );
}

export function SimpleDonutChart({
  data,
  size = 160,
  strokeWidth = 26,
  centerLabel,
  className = '',
}: SimpleDonutChartProps) {
  const total = Math.max(1, data.reduce((sum, entry) => sum + entry.value, 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {data.map((entry) => {
          const segment = (entry.value / total) * circumference;
          const dashArray = `${segment} ${circumference - segment}`;
          const dashOffset = -offset;
          offset += segment;

          return (
            <circle
              key={entry.name}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={entry.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      {centerLabel ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Total</p>
            <p className="text-lg font-bold text-slate-900">{centerLabel}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
