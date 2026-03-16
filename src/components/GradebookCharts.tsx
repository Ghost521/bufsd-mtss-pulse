import React from 'react';
import type { AssignmentType } from '../constants';
import { SimpleDonutChart } from './SimpleCharts';

type WeightDistributionChartProps = {
  tempWeights: Record<AssignmentType, number>;
  colors: string[];
  totalTempWeight: number;
  remainingWeight: number;
};

type GradeTrendPoint = {
  title: string;
  value: number;
};

type GradeTrendSparklineProps = {
  avg: number;
  trendData: GradeTrendPoint[];
};

const SPARKLINE_WIDTH = 72;
const SPARKLINE_HEIGHT = 24;
const SPARKLINE_PADDING = 2;

const toSparklinePoint = (value: number, index: number, count: number): string => {
  const x =
    count <= 1
      ? SPARKLINE_WIDTH / 2
      : SPARKLINE_PADDING + (index / (count - 1)) * (SPARKLINE_WIDTH - SPARKLINE_PADDING * 2);
  const normalized = Math.max(0, Math.min(100, value)) / 100;
  const y = SPARKLINE_HEIGHT - SPARKLINE_PADDING - normalized * (SPARKLINE_HEIGHT - SPARKLINE_PADDING * 2);
  return `${x},${y}`;
};

export function WeightDistributionChart({
  tempWeights,
  colors,
  totalTempWeight,
  remainingWeight,
}: WeightDistributionChartProps) {
  return (
    <div className="relative grid h-40 w-40 shrink-0 place-items-center overflow-hidden">
      <SimpleDonutChart
        data={Object.entries(tempWeights).map(([name, value], index) => ({
          name,
          value,
          color: colors[index % colors.length],
        }))}
        size={160}
        strokeWidth={26}
        centerLabel={`${totalTempWeight}%`}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-9 flex justify-center">
        <span className={`text-[10px] font-bold ${remainingWeight === 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
          {remainingWeight === 0 ? 'Balanced' : remainingWeight > 0 ? `${remainingWeight}% left` : `${Math.abs(remainingWeight)}% over`}
        </span>
      </div>
    </div>
  );
}

export function GradeTrendSparkline({ avg, trendData }: GradeTrendSparklineProps) {
  if (trendData.length === 0) {
    return <div className="h-6 w-full px-2 opacity-70" />;
  }

  const polylinePoints = trendData.map((point, index) => toSparklinePoint(point.value, index, trendData.length)).join(' ');
  const stroke = avg >= 90 ? '#10b981' : avg < 70 ? '#f43f5e' : '#6366f1';

  return (
    <div className="relative flex h-6 w-full items-center justify-center px-2 opacity-70">
      <svg viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`} className="h-6 w-[72px]" role="img" aria-label="Student trend sparkline">
        <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={polylinePoints} />
        {trendData.map((point, index) => {
          const [cx, cy] = toSparklinePoint(point.value, index, trendData.length).split(',');
          return (
            <circle key={`${point.title}-${index}`} cx={cx} cy={cy} r="1.75" fill={stroke}>
              <title>{`${point.title}: Score ${point.value}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
