import type { StaffRosterItem } from "../types";

export type InterventionistFocus = "Math" | "Reading";

const READING_KEYWORDS = ["reading", "read", "phonics", "fluency", "literacy", "comprehension"];
const MATH_KEYWORDS = ["math", "mathematics", "numeracy", "algebra", "calculation", "number sense"];

const FOCUS_VALUES: InterventionistFocus[] = ["Math", "Reading"];

const normalizeText = (value: string | null | undefined): string => value?.trim().toLowerCase() ?? "";

const hasKeyword = (source: string, keywords: string[]): boolean => keywords.some((keyword) => source.includes(keyword));

export const normalizeInterventionFocus = (
  input: Array<InterventionistFocus | string> | null | undefined,
): InterventionistFocus[] => {
  if (!input) return [];
  const normalized = input
    .map((focus) => normalizeText(focus))
    .map((focus): InterventionistFocus | null => {
      if (focus === "math") return "Math";
      if (focus === "reading") return "Reading";
      return null;
    })
    .filter((focus): focus is InterventionistFocus => focus !== null);

  return FOCUS_VALUES.filter((focus) => normalized.includes(focus));
};

export const resolveInterventionFocus = (input: {
  focusArea?: string | null;
  planName?: string | null;
  note?: string | null;
}): InterventionistFocus[] => {
  const explicit = normalizeText(input.focusArea);
  if (explicit) {
    if (hasKeyword(explicit, MATH_KEYWORDS) && !hasKeyword(explicit, READING_KEYWORDS)) return ["Math"];
    if (hasKeyword(explicit, READING_KEYWORDS) && !hasKeyword(explicit, MATH_KEYWORDS)) return ["Reading"];
    if (explicit === "math") return ["Math"];
    if (explicit === "reading") return ["Reading"];
  }

  const keywordSource = `${normalizeText(input.focusArea)} ${normalizeText(input.planName)} ${normalizeText(input.note)}`.trim();
  const hasMath = hasKeyword(keywordSource, MATH_KEYWORDS);
  const hasReading = hasKeyword(keywordSource, READING_KEYWORDS);

  if (hasMath && hasReading) return ["Math", "Reading"];
  if (hasMath) return ["Math"];
  if (hasReading) return ["Reading"];
  return ["Math", "Reading"];
};

export const getInterventionistRecipients = (
  staffRows: Array<Pick<StaffRosterItem, "name" | "role" | "isInterventionist" | "interventionFocus">>,
  focuses: InterventionistFocus[],
): string[] => {
  const focusSet = new Set(focuses);
  const names: string[] = [];
  const seen = new Set<string>();

  for (const row of staffRows) {
    if (row.role !== "Teacher") continue;
    if (!row.isInterventionist) continue;
    const rowFocus = normalizeInterventionFocus(row.interventionFocus);
    const effectiveFocus = rowFocus.length > 0 ? rowFocus : FOCUS_VALUES;
    if (!effectiveFocus.some((focus) => focusSet.has(focus))) continue;
    const normalizedName = row.name.trim();
    if (!normalizedName) continue;
    const key = normalizedName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(normalizedName);
  }

  return names;
};
