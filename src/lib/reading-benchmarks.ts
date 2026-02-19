import { UserRole } from "../types";
import type { RiskTone } from "./student-risk";

export const READING_BENCHMARK_GRADE_ORDER = ["K", "1", "2", "3", "4", "5", "6", "7", "8"] as const;
export type NormalizedGrade = (typeof READING_BENCHMARK_GRADE_ORDER)[number];

export type ReadingBand = {
  min: string;
  max: string;
};

export type ReadingBenchmarkMap = Record<NormalizedGrade, ReadingBand>;
export type ReadingBenchmarkOverrides = Partial<Record<NormalizedGrade, ReadingBand>>;
export type ReadingRiskMode = "distance" | "band";

export type ReadingRiskResult = {
  tone: RiskTone;
  label: string;
  mode: ReadingRiskMode;
  targetBand?: ReadingBand;
  normalizedGrade?: NormalizedGrade;
  distanceFromTargetMin?: number;
};

export const DEFAULT_READING_BENCHMARKS: ReadingBenchmarkMap = {
  K: { min: "A", max: "C" },
  "1": { min: "D", max: "I" },
  "2": { min: "J", max: "M" },
  "3": { min: "N", max: "P" },
  "4": { min: "Q", max: "S" },
  "5": { min: "T", max: "V" },
  "6": { min: "W", max: "X" },
  "7": { min: "Y", max: "Z" },
  "8": { min: "Z", max: "Z" },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const normalizeReadingLevel = (readingLevel: string): string | null => {
  const value = readingLevel.trim().toUpperCase();
  if (value.length === 0) return null;

  if (/^[A-Z]$/.test(value)) return value;

  const standaloneMatches = Array.from(value.matchAll(/(?:^|[^A-Z])([A-Z])(?=[^A-Z]|$)/g));
  if (standaloneMatches.length > 0) {
    return standaloneMatches[standaloneMatches.length - 1]?.[1] ?? null;
  }

  const fallback = value.match(/[A-Z]/);
  return fallback ? fallback[0] : null;
};

export const readingLevelToIndex = (readingLevel: string): number | null => {
  const normalized = normalizeReadingLevel(readingLevel);
  if (!normalized) return null;
  const code = normalized.charCodeAt(0);
  if (code < 65 || code > 90) return null;
  return code - 64;
};

export const normalizeGrade = (grade: string): NormalizedGrade | null => {
  const value = grade.trim().toLowerCase();
  if (value.length === 0) return null;

  const isGradeRange = /\b(?:k|kindergarten|[0-9]{1,2})(?:st|nd|rd|th)?\s*-\s*(?:k|kindergarten|[0-9]{1,2})(?:st|nd|rd|th)?\b/.test(value);
  if (isGradeRange) return null;

  if (value === "k" || value === "kg" || value === "kindergarten") return "K";

  const ordinalMatch = value.match(/\b([1-8])(?:st|nd|rd|th)?\b/);
  if (ordinalMatch) {
    const next = ordinalMatch[1];
    return READING_BENCHMARK_GRADE_ORDER.includes(next as NormalizedGrade) ? (next as NormalizedGrade) : null;
  }

  const numericMatch = value.match(/\b0*([1-8])\b/);
  if (numericMatch) {
    const next = numericMatch[1];
    return READING_BENCHMARK_GRADE_ORDER.includes(next as NormalizedGrade) ? (next as NormalizedGrade) : null;
  }

  return null;
};

const normalizeBand = (value: unknown): ReadingBand | null => {
  if (!isObject(value)) return null;
  const min = typeof value.min === "string" ? normalizeReadingLevel(value.min) : null;
  const max = typeof value.max === "string" ? normalizeReadingLevel(value.max) : null;
  if (!min || !max) return null;
  const minIndex = readingLevelToIndex(min);
  const maxIndex = readingLevelToIndex(max);
  if (minIndex === null || maxIndex === null || minIndex > maxIndex) return null;
  return { min, max };
};

export const mergeReadingBenchmarks = (overrides?: unknown): ReadingBenchmarkMap => {
  const next: ReadingBenchmarkMap = { ...DEFAULT_READING_BENCHMARKS };
  if (!isObject(overrides)) return next;

  for (const grade of READING_BENCHMARK_GRADE_ORDER) {
    const candidate = normalizeBand(overrides[grade]);
    if (candidate) next[grade] = candidate;
  }

  return next;
};

const resolveReadingRiskMode = (role: UserRole): ReadingRiskMode => (role === UserRole.TEACHER ? "distance" : "band");

const getBandIndexForLevel = (levelIndex: number, benchmarks: ReadingBenchmarkMap): number => {
  let resolved = 0;
  for (let index = 0; index < READING_BENCHMARK_GRADE_ORDER.length; index += 1) {
    const grade = READING_BENCHMARK_GRADE_ORDER[index];
    const band = benchmarks[grade];
    const minIndex = readingLevelToIndex(band.min) ?? 1;
    if (levelIndex >= minIndex) {
      resolved = index;
    }
  }
  return resolved;
};

const buildDistanceLabel = (tone: RiskTone, distance: number, targetMin: string): string => {
  const signed = distance >= 0 ? `+${distance}` : `${distance}`;
  if (tone === "good") return `On track (${signed} vs target ${targetMin})`;
  if (tone === "warn") return `Watch (${signed} vs target ${targetMin})`;
  if (tone === "risk") return `Urgent (${signed} vs target ${targetMin})`;
  return "No data";
};

export const evaluateReadingRisk = (params: {
  grade: string;
  readingLevel: string;
  role: UserRole;
  benchmarks?: ReadingBenchmarkMap;
}): ReadingRiskResult => {
  const normalizedGrade = normalizeGrade(params.grade);
  const readingIndex = readingLevelToIndex(params.readingLevel);
  const mode = resolveReadingRiskMode(params.role);
  const benchmarks = params.benchmarks ?? DEFAULT_READING_BENCHMARKS;

  if (!normalizedGrade || readingIndex === null) {
    return { tone: "neutral", label: "No data", mode };
  }

  const targetBand = benchmarks[normalizedGrade];
  const targetMinIndex = readingLevelToIndex(targetBand.min);
  const targetGradeIndex = READING_BENCHMARK_GRADE_ORDER.indexOf(normalizedGrade);

  if (!targetBand || targetMinIndex === null || targetGradeIndex < 0) {
    return { tone: "neutral", label: "No data", mode, normalizedGrade };
  }

  if (mode === "distance") {
    const distance = readingIndex - targetMinIndex;
    const tone: RiskTone = distance >= 0 ? "good" : distance >= -2 ? "warn" : "risk";
    return {
      tone,
      mode,
      label: buildDistanceLabel(tone, distance, targetBand.min),
      targetBand,
      normalizedGrade,
      distanceFromTargetMin: distance,
    };
  }

  const achievedBandIndex = getBandIndexForLevel(readingIndex, benchmarks);
  const bandGap = targetGradeIndex - achievedBandIndex;

  if (bandGap <= 0) {
    return {
      tone: "good",
      mode,
      label: "On track",
      targetBand,
      normalizedGrade,
    };
  }
  if (bandGap === 1) {
    return {
      tone: "warn",
      mode,
      label: "Watch (1 band below target)",
      targetBand,
      normalizedGrade,
    };
  }
  return {
    tone: "risk",
    mode,
    label: "Urgent (2+ bands below target)",
    targetBand,
    normalizedGrade,
  };
};
