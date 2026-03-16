import React from 'react';
import { SimpleDonutChart } from './SimpleCharts';

type ReportTab = 'Executive' | 'Academics' | 'Behavior' | 'Interventions';

type TrendPoint = {
  name: string;
  attendance: number;
  referrals: number;
  chronic: number;
};

type TierPoint = {
  name: string;
  value: number;
  color: string;
};

type GradeBarPoint = {
  grade: string;
  math: number;
  reading: number;
  science: number;
};

type EfficacyBarPoint = {
  name: string;
  success: number;
};

type ReportsChartsPanelProps = {
  tab: ReportTab;
  monthlyTrend: TrendPoint[];
  tierDistribution: TierPoint[];
  gradeBars: GradeBarPoint[];
  efficacyBars: EfficacyBarPoint[];
};

type ChartMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type SeriesDefinition<T> = {
  key: keyof T;
  color: string;
  label: string;
};

const CHART_WIDTH = 760;
const CHART_HEIGHT = 288;
const CHART_MARGINS: ChartMargins = { top: 14, right: 44, bottom: 34, left: 40 };

const EmptyChartState: React.FC<{ message: string }> = ({ message }) => (
  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">{message}</p>
);

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const getPlotDimensions = (width: number, height: number, margins: ChartMargins) => ({
  plotWidth: width - margins.left - margins.right,
  plotHeight: height - margins.top - margins.bottom,
});

const getX = (index: number, count: number, width: number, margins: ChartMargins): number => {
  const { plotWidth } = getPlotDimensions(width, CHART_HEIGHT, margins);
  if (count <= 1) return margins.left + plotWidth / 2;
  return margins.left + (index / (count - 1)) * plotWidth;
};

const getY = (value: number, min: number, max: number, height: number, margins: ChartMargins): number => {
  const { plotHeight } = getPlotDimensions(CHART_WIDTH, height, margins);
  const normalized = (clamp(value, min, max) - min) / Math.max(1, max - min);
  return margins.top + plotHeight - normalized * plotHeight;
};

const getPolylinePoints = <T extends object>(
  data: T[],
  valueKey: keyof T,
  min: number,
  max: number,
): string =>
  data
    .map((item, index) => {
      const x = getX(index, data.length, CHART_WIDTH, CHART_MARGINS);
      const y = getY(Number(item[valueKey]), min, max, CHART_HEIGHT, CHART_MARGINS);
      return `${x},${y}`;
    })
    .join(' ');

const getAreaPath = <T extends object>(
  data: T[],
  valueKey: keyof T,
  min: number,
  max: number,
): string => {
  if (data.length === 0) return '';
  const points = data.map((item, index) => ({
    x: getX(index, data.length, CHART_WIDTH, CHART_MARGINS),
    y: getY(Number(item[valueKey]), min, max, CHART_HEIGHT, CHART_MARGINS),
  }));
  const baseline = CHART_HEIGHT - CHART_MARGINS.bottom;
  return [
    `M ${points[0]?.x ?? CHART_MARGINS.left} ${baseline}`,
    ...points.map((point, index) => `${index === 0 ? 'L' : 'L'} ${point.x} ${point.y}`),
    `L ${points[points.length - 1]?.x ?? CHART_MARGINS.left} ${baseline}`,
    'Z',
  ].join(' ');
};

const ChartLegend = <T extends object>({ series }: { series: Array<SeriesDefinition<T>> }) => (
  <div className="mb-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
    {series.map((entry) => (
      <span key={entry.label} className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
        {entry.label}
      </span>
    ))}
  </div>
);

function LineChartSvg<T extends { name: string }>({
  data,
  series,
  min,
  max,
  leftTickFormatter,
}: {
  data: T[];
  series: Array<SeriesDefinition<T>>;
  min: number;
  max: number;
  leftTickFormatter?: (value: number) => string;
}) {
  const yTicks = Array.from({ length: 5 }, (_, index) => min + ((max - min) / 4) * index).reverse();

  return (
    <div className="h-72 w-full">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-full w-full" role="img" aria-label="Line chart">
        {yTicks.map((tick) => {
          const y = getY(tick, min, max, CHART_HEIGHT, CHART_MARGINS);
          return (
            <g key={`tick-${tick}`}>
              <line
                x1={CHART_MARGINS.left}
                x2={CHART_WIDTH - CHART_MARGINS.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
              />
              <text x={CHART_MARGINS.left - 8} y={y + 4} fontSize="10" textAnchor="end" fill="#64748b">
                {leftTickFormatter ? leftTickFormatter(Math.round(tick)) : Math.round(tick)}
              </text>
            </g>
          );
        })}

        {series.map((entry) => (
          <polyline
            key={entry.label}
            fill="none"
            stroke={entry.color}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={getPolylinePoints(data, entry.key, min, max)}
          />
        ))}

        {data.map((item, index) => {
          const x = getX(index, data.length, CHART_WIDTH, CHART_MARGINS);
          return (
            <g key={`${item.name}-${index}`}>
              {series.map((entry) => {
                const value = Number(item[entry.key]);
                const y = getY(value, min, max, CHART_HEIGHT, CHART_MARGINS);
                return (
                  <circle key={`${String(entry.key)}-${item.name}`} cx={x} cy={y} r="4" fill={entry.color}>
                    <title>{`${item.name}: ${entry.label} ${value}`}</title>
                  </circle>
                );
              })}
              <text x={x} y={CHART_HEIGHT - 10} fontSize="10" textAnchor="middle" fill="#64748b">
                {item.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AreaComparisonChart({ data }: { data: TrendPoint[] }) {
  const maxReferrals = Math.max(4, ...data.map((item) => item.referrals));
  const attendanceTicks = [100, 95, 90, 85, 80];
  const referralTicks = Array.from({ length: 5 }, (_, index) => Math.round((maxReferrals / 4) * index)).reverse();

  return (
    <div className="h-72 w-full">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-full w-full" role="img" aria-label="Attendance and referral trend chart">
        {attendanceTicks.map((tick) => {
          const y = getY(tick, 80, 100, CHART_HEIGHT, CHART_MARGINS);
          return (
            <g key={`attendance-${tick}`}>
              <line
                x1={CHART_MARGINS.left}
                x2={CHART_WIDTH - CHART_MARGINS.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
              />
              <text x={CHART_MARGINS.left - 8} y={y + 4} fontSize="10" textAnchor="end" fill="#64748b">
                {tick}%
              </text>
            </g>
          );
        })}

        {referralTicks.map((tick) => {
          const y = getY(tick, 0, maxReferrals, CHART_HEIGHT, CHART_MARGINS);
          return (
            <text key={`referral-${tick}`} x={CHART_WIDTH - CHART_MARGINS.right + 8} y={y + 4} fontSize="10" fill="#64748b">
              {tick}
            </text>
          );
        })}

        <path d={getAreaPath(data, 'attendance', 80, 100)} fill="#6366f1" opacity="0.18" />
        <path d={getAreaPath(data, 'referrals', 0, maxReferrals)} fill="#f43f5e" opacity="0.16" />
        <polyline fill="none" stroke="#6366f1" strokeWidth="3" points={getPolylinePoints(data, 'attendance', 80, 100)} />
        <polyline fill="none" stroke="#f43f5e" strokeWidth="3" points={getPolylinePoints(data, 'referrals', 0, maxReferrals)} />

        {data.map((item, index) => {
          const x = getX(index, data.length, CHART_WIDTH, CHART_MARGINS);
          const attendanceY = getY(item.attendance, 80, 100, CHART_HEIGHT, CHART_MARGINS);
          const referralsY = getY(item.referrals, 0, maxReferrals, CHART_HEIGHT, CHART_MARGINS);
          return (
            <g key={item.name}>
              <circle cx={x} cy={attendanceY} r="4" fill="#6366f1">
                <title>{`${item.name}: Attendance ${item.attendance}%`}</title>
              </circle>
              <circle cx={x} cy={referralsY} r="4" fill="#f43f5e">
                <title>{`${item.name}: Referrals ${item.referrals}`}</title>
              </circle>
              <text x={x} y={CHART_HEIGHT - 10} fontSize="10" textAnchor="middle" fill="#64748b">
                {item.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function GroupedBarChart({
  data,
  series,
}: {
  data: GradeBarPoint[];
  series: Array<SeriesDefinition<GradeBarPoint>>;
}) {
  const maxValue = 100;

  return (
    <div className="h-80 w-full">
      <div className="flex h-full items-end gap-4">
        {data.map((item) => (
          <div key={item.grade} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-3">
            <div className="flex h-full items-end justify-center gap-2 rounded-t-2xl bg-slate-50/70 px-2 pt-4">
              {series.map((entry) => {
                const value = Number(item[entry.key]);
                const height = Math.max(10, Math.round((value / maxValue) * 100));
                return (
                  <div key={`${item.grade}-${entry.label}`} className="flex flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[10px] font-semibold text-slate-500">{value}%</span>
                    <div
                      className="w-full rounded-t-xl shadow-sm transition-[height] duration-500"
                      style={{ height: `${height}%`, backgroundColor: entry.color }}
                      title={`${item.grade}: ${entry.label} ${value}%`}
                      aria-label={`${item.grade}: ${entry.label} ${value} percent`}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-center text-xs font-semibold text-slate-600">{item.grade}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SingleBarChart({ data }: { data: EfficacyBarPoint[] }) {
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.name} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">{item.name}</p>
            <p className="text-sm font-bold text-slate-900">{item.success}%</p>
          </div>
          <div className="h-3 rounded-full bg-slate-200">
            <div
              className="h-3 rounded-full bg-indigo-500 transition-[width] duration-500"
              style={{ width: `${Math.max(0, Math.min(100, item.success))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportsChartsPanel({
  tab,
  monthlyTrend,
  tierDistribution,
  gradeBars,
  efficacyBars,
}: ReportsChartsPanelProps) {
  if (tab === 'Executive') {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-4 font-bold text-slate-800">Attendance and Referral Trend</h3>
          {monthlyTrend.length === 0 ? (
            <EmptyChartState message="No attendance trend data is available yet." />
          ) : (
            <>
              <ChartLegend<TrendPoint>
                series={[
                  { key: 'attendance', color: '#6366f1', label: 'Attendance' },
                  { key: 'referrals', color: '#f43f5e', label: 'Referrals' },
                ]}
              />
              <AreaComparisonChart data={monthlyTrend} />
            </>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-4 font-bold text-slate-800">Tier Distribution</h3>
          {tierDistribution.every((entry) => entry.value === 0) ? (
            <EmptyChartState message="No student tier distribution is available yet." />
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-4">
              <SimpleDonutChart
                data={tierDistribution.map((entry) => ({
                  name: entry.name,
                  value: entry.value,
                  color: entry.color,
                }))}
                size={180}
                strokeWidth={30}
                centerLabel={String(tierDistribution.reduce((sum, entry) => sum + entry.value, 0))}
              />
              <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold text-slate-600">
                {tierDistribution.map((entry) => (
                  <span key={entry.name} className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    {entry.name}: {entry.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (tab === 'Academics') {
    return (
      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-bold text-slate-800">Grade Proficiency Estimate</h3>
        {gradeBars.length === 0 ? (
          <EmptyChartState message="No academic proficiency data is available yet." />
        ) : (
          <>
            <ChartLegend<GradeBarPoint>
              series={[
                { key: 'math', color: '#6366f1', label: 'Math' },
                { key: 'reading', color: '#10b981', label: 'Reading' },
                { key: 'science', color: '#f59e0b', label: 'Science' },
              ]}
            />
            <GroupedBarChart
              data={gradeBars}
              series={[
                { key: 'math', color: '#6366f1', label: 'Math' },
                { key: 'reading', color: '#10b981', label: 'Reading' },
                { key: 'science', color: '#f59e0b', label: 'Science' },
              ]}
            />
          </>
        )}
      </div>
    );
  }

  if (tab === 'Behavior') {
    return (
      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-bold text-slate-800">Behavior/Attendance Risk Trend</h3>
        {monthlyTrend.length === 0 ? (
          <EmptyChartState message="No behavior trend data is available yet." />
        ) : (
          <>
            <ChartLegend<TrendPoint>
              series={[
                { key: 'referrals', color: '#f43f5e', label: 'Referrals' },
                { key: 'chronic', color: '#f59e0b', label: 'Chronic Risk' },
              ]}
            />
            <LineChartSvg
              data={monthlyTrend}
              series={[
                { key: 'referrals', color: '#f43f5e', label: 'Referrals' },
                { key: 'chronic', color: '#f59e0b', label: 'Chronic Risk' },
              ]}
              min={0}
              max={Math.max(6, ...monthlyTrend.flatMap((item) => [item.referrals, item.chronic]))}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 font-bold text-slate-800">Intervention Efficacy</h3>
      {efficacyBars.length === 0 ? (
        <EmptyChartState message="No intervention efficacy data is available yet." />
      ) : (
        <SingleBarChart data={efficacyBars} />
      )}
    </div>
  );
}
