import React from 'react';
import type { ReadingStage } from '../types';

type ReadingChartPoint = {
  id: string;
  date: string;
  dateLabel: string;
  fAndPLevel: string;
  levelIndex: number;
  stage: ReadingStage;
  lexileLabel: string;
  atosLabel: string;
  notes: string;
};

type StageRange = {
  stage: ReadingStage;
  minLevel: string;
  maxLevel: string;
  fill: string;
  textClassName: string;
  minIndex: number;
  maxIndex: number;
};

type AcademicChartPoint = {
  id: string;
  date: string;
  label: string;
  mathScore: number;
  readingScore: number;
};

type ReadingProgressChartProps = {
  readingChartPoints: ReadingChartPoint[];
  stageRanges: StageRange[];
  gradeTargetRange: { minIndex: number; maxIndex: number } | null;
  latestReadingChartPoint: ReadingChartPoint | null;
};

type AcademicProgressChartProps = {
  academicChartData: AcademicChartPoint[];
  showMathSeries: boolean;
  showReadingSeries: boolean;
  onMonthToggle: (label: string) => void;
};

type ChartMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const READING_WIDTH = 760;
const READING_HEIGHT = 430;
const READING_MARGINS: ChartMargins = { top: 16, right: 28, bottom: 32, left: 42 };

const ACADEMIC_WIDTH = 720;
const ACADEMIC_HEIGHT = 260;
const ACADEMIC_MARGINS: ChartMargins = { top: 14, right: 18, bottom: 34, left: 40 };

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const getPlotDimensions = (width: number, height: number, margins: ChartMargins) => ({
  plotWidth: width - margins.left - margins.right,
  plotHeight: height - margins.top - margins.bottom,
});

const getXPosition = (index: number, count: number, width: number, margins: ChartMargins): number => {
  const { plotWidth } = getPlotDimensions(width, READING_HEIGHT, margins);
  if (count <= 1) return margins.left + plotWidth / 2;
  return margins.left + (index / (count - 1)) * plotWidth;
};

const getYPosition = (
  value: number,
  min: number,
  max: number,
  height: number,
  margins: ChartMargins,
): number => {
  const { plotHeight } = getPlotDimensions(READING_WIDTH, height, margins);
  const normalized = (clamp(value, min, max) - min) / Math.max(1, max - min);
  return margins.top + plotHeight - normalized * plotHeight;
};

const toPolylinePoints = (
  values: number[],
  count: number,
  width: number,
  height: number,
  margins: ChartMargins,
  min: number,
  max: number,
): string =>
  values
    .map((value, index) => {
      const x = getXPosition(index, count, width, margins);
      const y = getYPosition(value, min, max, height, margins);
      return `${x},${y}`;
    })
    .join(' ');

const ChartEmptyState: React.FC<{ height: number }> = ({ height }) => (
  <div
    className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500"
    style={{ height }}
  >
    Chart is loading...
  </div>
);

export function ReadingProgressChart({
  readingChartPoints,
  stageRanges,
  gradeTargetRange,
  latestReadingChartPoint,
}: ReadingProgressChartProps) {
  if (readingChartPoints.length === 0) {
    return <ChartEmptyState height={READING_HEIGHT} />;
  }

  const { plotWidth } = getPlotDimensions(READING_WIDTH, READING_HEIGHT, READING_MARGINS);
  const yTicks = Array.from({ length: 26 }, (_, index) => index + 1);
  const polylinePoints = toPolylinePoints(
    readingChartPoints.map((point) => point.levelIndex),
    readingChartPoints.length,
    READING_WIDTH,
    READING_HEIGHT,
    READING_MARGINS,
    1,
    26,
  );

  return (
    <div className="h-[430px] w-full">
      <svg viewBox={`0 0 ${READING_WIDTH} ${READING_HEIGHT}`} className="h-full w-full" role="img" aria-label="Reading progress chart">
        {stageRanges.map((band) => {
          const top = getYPosition(band.maxIndex, 1, 26, READING_HEIGHT, READING_MARGINS);
          const bottom = getYPosition(band.minIndex, 1, 26, READING_HEIGHT, READING_MARGINS);
          return (
            <rect
              key={`stage-${band.stage}`}
              x={READING_MARGINS.left}
              y={top}
              width={plotWidth}
              height={Math.max(0, bottom - top)}
              fill={band.fill}
              opacity={0.55}
            />
          );
        })}

        {gradeTargetRange ? (
          <rect
            x={READING_MARGINS.left}
            y={getYPosition(gradeTargetRange.maxIndex, 1, 26, READING_HEIGHT, READING_MARGINS)}
            width={plotWidth}
            height={
              getYPosition(gradeTargetRange.minIndex, 1, 26, READING_HEIGHT, READING_MARGINS) -
              getYPosition(gradeTargetRange.maxIndex, 1, 26, READING_HEIGHT, READING_MARGINS)
            }
            fill="#6366f1"
            opacity={0.14}
          />
        ) : null}

        {yTicks.map((tick) => {
          const y = getYPosition(tick, 1, 26, READING_HEIGHT, READING_MARGINS);
          return (
            <g key={`reading-tick-${tick}`}>
              <line
                x1={READING_MARGINS.left}
                x2={READING_WIDTH - READING_MARGINS.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
              />
              <text x={READING_MARGINS.left - 10} y={y + 3} fontSize="10" textAnchor="end" fill="#64748b">
                {String.fromCharCode(64 + tick)}
              </text>
            </g>
          );
        })}

        {latestReadingChartPoint ? (
          <line
            x1={READING_MARGINS.left}
            x2={READING_WIDTH - READING_MARGINS.right}
            y1={getYPosition(latestReadingChartPoint.levelIndex, 1, 26, READING_HEIGHT, READING_MARGINS)}
            y2={getYPosition(latestReadingChartPoint.levelIndex, 1, 26, READING_HEIGHT, READING_MARGINS)}
            stroke="#0f766e"
            strokeDasharray="4 4"
          />
        ) : null}

        <polyline fill="none" stroke="#0f766e" strokeWidth="3" points={polylinePoints} />

        {readingChartPoints.map((point, index) => {
          const x = getXPosition(index, readingChartPoints.length, READING_WIDTH, READING_MARGINS);
          const y = getYPosition(point.levelIndex, 1, 26, READING_HEIGHT, READING_MARGINS);
          return (
            <g key={point.id}>
              <circle cx={x} cy={y} r="4.5" fill="#0f766e" stroke="#ffffff" strokeWidth="1.5">
                <title>{`${point.dateLabel}: Level ${point.fAndPLevel}, ${point.stage}, Lexile ${point.lexileLabel}, ATOS ${point.atosLabel}${point.notes ? `. ${point.notes}` : ''}`}</title>
              </circle>
              <text
                x={x}
                y={READING_HEIGHT - 10}
                fontSize="10"
                textAnchor="middle"
                fill="#64748b"
              >
                {point.dateLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AcademicProgressChart({
  academicChartData,
  showMathSeries,
  showReadingSeries,
  onMonthToggle,
}: AcademicProgressChartProps) {
  if (academicChartData.length === 0) {
    return <ChartEmptyState height={ACADEMIC_HEIGHT} />;
  }

  const yTicks = [0, 25, 50, 75, 100];
  const mathPolyline = showMathSeries
    ? toPolylinePoints(
        academicChartData.map((point) => point.mathScore),
        academicChartData.length,
        ACADEMIC_WIDTH,
        ACADEMIC_HEIGHT,
        ACADEMIC_MARGINS,
        0,
        100,
      )
    : '';
  const readingPolyline = showReadingSeries
    ? toPolylinePoints(
        academicChartData.map((point) => point.readingScore),
        academicChartData.length,
        ACADEMIC_WIDTH,
        ACADEMIC_HEIGHT,
        ACADEMIC_MARGINS,
        0,
        100,
      )
    : '';

  return (
    <div className="min-h-[260px] w-full min-w-0">
      <svg
        viewBox={`0 0 ${ACADEMIC_WIDTH} ${ACADEMIC_HEIGHT}`}
        className="h-[260px] w-full"
        role="img"
        aria-label="Academic progress chart"
      >
        {yTicks.map((tick) => {
          const y = getYPosition(tick, 0, 100, ACADEMIC_HEIGHT, ACADEMIC_MARGINS);
          return (
            <g key={`academic-tick-${tick}`}>
              <line
                x1={ACADEMIC_MARGINS.left}
                x2={ACADEMIC_WIDTH - ACADEMIC_MARGINS.right}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray="3 3"
              />
              <text x={ACADEMIC_MARGINS.left - 8} y={y + 4} fontSize="10" textAnchor="end" fill="#64748b">
                {tick}
              </text>
            </g>
          );
        })}

        {showMathSeries ? <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={mathPolyline} /> : null}
        {showReadingSeries ? <polyline fill="none" stroke="#059669" strokeWidth="3" points={readingPolyline} /> : null}

        {academicChartData.map((point, index) => {
          const x = getXPosition(index, academicChartData.length, ACADEMIC_WIDTH, ACADEMIC_MARGINS);
          const mathY = getYPosition(point.mathScore, 0, 100, ACADEMIC_HEIGHT, ACADEMIC_MARGINS);
          const readingY = getYPosition(point.readingScore, 0, 100, ACADEMIC_HEIGHT, ACADEMIC_MARGINS);

          return (
            <g key={point.id}>
              {showMathSeries ? (
                <circle
                  cx={x}
                  cy={mathY}
                  r="4"
                  fill="#2563eb"
                  className="cursor-pointer"
                  onClick={() => onMonthToggle(point.label)}
                >
                  <title>{`${point.label}: Math ${point.mathScore}%`}</title>
                </circle>
              ) : null}
              {showReadingSeries ? (
                <circle
                  cx={x}
                  cy={readingY}
                  r="4"
                  fill="#059669"
                  className="cursor-pointer"
                  onClick={() => onMonthToggle(point.label)}
                >
                  <title>{`${point.label}: Reading ${point.readingScore}%`}</title>
                </circle>
              ) : null}
              <text x={x} y={ACADEMIC_HEIGHT - 10} fontSize="10" textAnchor="middle" fill="#64748b">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
