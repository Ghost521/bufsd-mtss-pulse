export const stripJsonCodeFences = (value: string): string => {
  return value.replace(/```json/gi, "").replace(/```/g, "").trim();
};

export const safeJsonParse = <T>(raw: string | undefined | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(stripJsonCodeFences(raw)) as T;
    return parsed;
  } catch {
    return fallback;
  }
};

const isString = (value: unknown): value is string => typeof value === "string";

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every(isString);
};

export const normalizeImportAnalysisResult = (
  value: unknown
): { summary: string; anomalies: string[]; recommendations: string[] } => {
  if (!value || typeof value !== "object") {
    return { summary: "Analysis failed.", anomalies: [], recommendations: [] };
  }
  const candidate = value as Record<string, unknown>;
  return {
    summary: isString(candidate.summary) ? candidate.summary : "Analysis failed.",
    anomalies: isStringArray(candidate.anomalies) ? candidate.anomalies : [],
    recommendations: isStringArray(candidate.recommendations) ? candidate.recommendations : [],
  };
};

export const normalizeActionItemPlan = (value: unknown): { title: string; notes: string } => {
  if (!value || typeof value !== "object") return { title: "Draft Plan", notes: "AI unavailable." };
  const candidate = value as Record<string, unknown>;
  return {
    title: isString(candidate.title) ? candidate.title : "Draft Plan",
    notes: isString(candidate.notes) ? candidate.notes : "AI unavailable.",
  };
};

