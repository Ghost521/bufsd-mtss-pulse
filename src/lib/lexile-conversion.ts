import type { ReadingStage } from "../types";

export type LexileConversionRow = {
  lexileLabel: string;
  lexileValue: number;
  fpLevel: string;
  atosLabel: string;
  atosValue: number;
  stage: ReadingStage;
  order: number;
};

export type LexileLevelSummary = {
  fpLevel: string;
  stage: ReadingStage;
  lexileMin: number;
  lexileMax: number;
  lexileLabel: string;
  atosMin: number;
  atosMax: number;
  atosLabel: string;
};

const STAGE_BY_FP_LEVEL: Record<string, ReadingStage> = {
  A: "Emergent",
  B: "Emergent",
  C: "Emergent",
  D: "Early",
  E: "Early",
  F: "Early",
  G: "Early",
  H: "Early",
  I: "Early",
  J: "Transitional",
  K: "Transitional",
  L: "Transitional",
  M: "Transitional",
  N: "Transitional",
  O: "Transitional",
  P: "Transitional",
  Q: "Fluent",
  R: "Fluent",
  S: "Fluent",
  T: "Fluent",
  U: "Fluent",
  V: "Fluent",
  W: "Fluent",
  X: "Fluent",
  Y: "Fluent",
  Z: "Fluent",
  "Z+": "Advanced",
};

const RAW_ROWS: Array<[lexile: string, fpLevel: string, atos: string]> = [
  // Source: Lexile-Conversion-Chart-1.pdf (Updated 2017), transcribed for deterministic UI mapping.
  ["25", "A", "0.2"],
  ["50", "B", "0.5"],
  ["75", "C", "0.65"],
  ["100", "D", "0.85"],
  ["125", "E", "1.0"],
  ["150", "E", "1.1"],
  ["175", "F", "1.3"],
  ["200", "G", "1.55"],
  ["225", "H", "1.7"],
  ["250", "H", "1.8"],
  ["275", "I", "2.0"],
  ["300", "J", "2.2"],
  ["325", "J", "2.4"],
  ["350", "K", "2.5"],
  ["375", "K", "2.7"],
  ["400", "L", "2.8"],
  ["425", "L", "3.1"],
  ["450", "M", "3.2"],
  ["475", "M", "3.5"],
  ["500", "N", "3.6"],
  ["525", "N", "3.65"],
  ["550", "N", "3.7"],
  ["575", "O", "3.8"],
  ["600", "O", "3.85"],
  ["625", "O", "3.9"],
  ["650", "P", "4.1"],
  ["675", "P", "4.2"],
  ["700", "Q", "4.3"],
  ["725", "Q", "4.4"],
  ["750", "R", "4.6"],
  ["775", "S", "4.8"],
  ["800", "S", "4.85"],
  ["825", "S", "4.9"],
  ["850", "T", "5.05"],
  ["875", "U", "5.3"],
  ["900", "V", "5.45"],
  ["925", "V", "5.55"],
  ["950", "W", "5.6"],
  ["975", "W", "5.7"],
  ["1000", "X", "5.9"],
  ["1025", "Y", "6.2"],
  ["1050", "Z", "6.4"],
  ["1075", "Z", "6.9"],
  ["1100", "Z", "7.0"],
  ["1125", "Z", "7.0+"],
  ["1150", "Z", "7.0+"],
  ["1175", "Z", "7.0+"],
  ["1200+", "Z+", "7.0+"],
];

const parseLexileValue = (value: string): number => Number.parseInt(value.replace("+", ""), 10);
const parseAtosValue = (value: string): number => Number.parseFloat(value.replace("+", ""));

export const LEXILE_CONVERSION_ROWS: LexileConversionRow[] = RAW_ROWS.map(([lexileLabel, fpLevel, atosLabel], index) => ({
  lexileLabel,
  lexileValue: parseLexileValue(lexileLabel),
  fpLevel,
  atosLabel,
  atosValue: parseAtosValue(atosLabel),
  stage: STAGE_BY_FP_LEVEL[fpLevel] ?? "Transitional",
  order: index + 1,
}));

export const FP_LEVEL_ORDER: string[] = Array.from(new Set(LEXILE_CONVERSION_ROWS.map((row) => row.fpLevel)));

export const FP_LEVEL_INDEX = new Map<string, number>(
  FP_LEVEL_ORDER.map((fpLevel, index) => [fpLevel, index + 1]),
);

export const LEXILE_LEVEL_SUMMARIES: LexileLevelSummary[] = FP_LEVEL_ORDER.map((fpLevel) => {
  const rows = LEXILE_CONVERSION_ROWS.filter((row) => row.fpLevel === fpLevel);
  const lexileMin = rows[0]?.lexileValue ?? 0;
  const lexileMax = rows[rows.length - 1]?.lexileValue ?? lexileMin;
  const atosMin = rows[0]?.atosValue ?? 0;
  const atosMax = rows[rows.length - 1]?.atosValue ?? atosMin;

  return {
    fpLevel,
    stage: STAGE_BY_FP_LEVEL[fpLevel] ?? "Transitional",
    lexileMin,
    lexileMax,
    lexileLabel: lexileMin === lexileMax ? `${rows[0]?.lexileLabel ?? lexileMin}L` : `${rows[0]?.lexileLabel ?? lexileMin}L - ${rows[rows.length - 1]?.lexileLabel ?? lexileMax}L`,
    atosMin,
    atosMax,
    atosLabel: atosMin === atosMax ? `${rows[0]?.atosLabel ?? atosMin}` : `${rows[0]?.atosLabel ?? atosMin} - ${rows[rows.length - 1]?.atosLabel ?? atosMax}`,
  };
});

export const normalizeFpLevel = (value: string): string | null => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;

  if (FP_LEVEL_INDEX.has(trimmed)) return trimmed;

  const candidates = trimmed.match(/[A-Z]\+?/g);
  if (!candidates || candidates.length === 0) return null;
  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const candidate = candidates[index];
    if (FP_LEVEL_INDEX.has(candidate)) return candidate;
  }
  return null;
};

export const fpLevelToIndex = (value: string): number | null => {
  const normalized = normalizeFpLevel(value);
  if (!normalized) return null;
  return FP_LEVEL_INDEX.get(normalized) ?? null;
};

export const getStageForFpLevel = (value: string): ReadingStage | null => {
  const normalized = normalizeFpLevel(value);
  if (!normalized) return null;
  return STAGE_BY_FP_LEVEL[normalized] ?? null;
};

export const getLexileSummaryForFpLevel = (value: string): LexileLevelSummary | null => {
  const normalized = normalizeFpLevel(value);
  if (!normalized) return null;
  return LEXILE_LEVEL_SUMMARIES.find((summary) => summary.fpLevel === normalized) ?? null;
};
