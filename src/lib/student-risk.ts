import { Tier } from "../types";

export type RiskTone = "good" | "warn" | "risk" | "neutral";

const parseGpa = (gpa: string): number | null => {
  const value = Number.parseFloat(gpa);
  return Number.isFinite(value) ? value : null;
};

const normalizeReadingLevel = (readingLevel: string): string | null => {
  const match = readingLevel.trim().toUpperCase().match(/[A-Z]/);
  return match ? match[0] : null;
};

export const getTierTone = (tier: Tier): RiskTone => {
  if (tier === Tier.TIER_3) return "risk";
  if (tier === Tier.TIER_2) return "warn";
  return "good";
};

export const getAttendanceTone = (attendance: number): RiskTone => {
  if (attendance < 90) return "risk";
  if (attendance < 95) return "warn";
  return "good";
};

export const getGpaTone = (gpa: string): RiskTone => {
  const value = parseGpa(gpa);
  if (value === null) return "neutral";
  if (value < 2) return "risk";
  if (value < 3) return "warn";
  return "good";
};

export const getReadingTone = (readingLevel: string): RiskTone => {
  const level = normalizeReadingLevel(readingLevel);
  if (!level) return "neutral";
  if (level <= "L") return "risk";
  if (level <= "Q") return "warn";
  return "good";
};

export const riskToneLabel = (tone: RiskTone): string => {
  if (tone === "good") return "On track";
  if (tone === "warn") return "Watch";
  if (tone === "risk") return "Urgent";
  return "No data";
};
