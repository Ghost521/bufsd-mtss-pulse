import { describe, expect, it } from "vitest";
import { UserRole } from "../src/types";
import {
  DEFAULT_READING_BENCHMARKS,
  evaluateReadingRisk,
  mergeReadingBenchmarks,
  normalizeGrade,
  normalizeReadingLevel,
  readingLevelToIndex,
} from "../src/lib/reading-benchmarks";

describe("reading benchmarks", () => {
  it("normalizes grade strings used by roster rows", () => {
    expect(normalizeGrade("Kindergarten")).toBe("K");
    expect(normalizeGrade("4th")).toBe("4");
    expect(normalizeGrade("Grade 5")).toBe("5");
    expect(normalizeGrade("08")).toBe("8");
    expect(normalizeGrade("K-5")).toBeNull();
    expect(normalizeGrade("Reading Recovery")).toBeNull();
  });

  it("normalizes and indexes reading levels", () => {
    expect(normalizeReadingLevel("q")).toBe("Q");
    expect(normalizeReadingLevel("Level M")).toBe("M");
    expect(normalizeReadingLevel("")).toBeNull();
    expect(readingLevelToIndex("A")).toBe(1);
    expect(readingLevelToIndex("Z")).toBe(26);
  });

  it("merges valid benchmark overrides and ignores invalid entries", () => {
    const merged = mergeReadingBenchmarks({
      "4": { min: "R", max: "T" },
      "5": { min: "x", max: "z" },
      bogus: { min: "A", max: "B" },
      "7": { min: "Z", max: "Y" },
    });

    expect(merged["4"]).toEqual({ min: "R", max: "T" });
    expect(merged["5"]).toEqual({ min: "X", max: "Z" });
    expect(merged["7"]).toEqual(DEFAULT_READING_BENCHMARKS["7"]);
  });

  it("evaluates teacher role with distance scoring", () => {
    const onTrack = evaluateReadingRisk({
      grade: "4th",
      readingLevel: "S",
      role: UserRole.TEACHER,
    });
    const watch = evaluateReadingRisk({
      grade: "4th",
      readingLevel: "P",
      role: UserRole.TEACHER,
    });
    const urgent = evaluateReadingRisk({
      grade: "4th",
      readingLevel: "L",
      role: UserRole.TEACHER,
    });

    expect(onTrack.mode).toBe("distance");
    expect(onTrack.tone).toBe("good");
    expect(onTrack.label).toContain("On track");
    expect(onTrack.label).toContain("target Q");

    expect(watch.tone).toBe("warn");
    expect(watch.label).toContain("Watch");
    expect(watch.label).toContain("-1");

    expect(urgent.tone).toBe("risk");
    expect(urgent.label).toContain("Urgent");
    expect(urgent.label).toContain("-5");
  });

  it("evaluates non-teacher roles with band scoring", () => {
    const onTrack = evaluateReadingRisk({
      grade: "4th",
      readingLevel: "Q",
      role: UserRole.PRINCIPAL,
    });
    const watch = evaluateReadingRisk({
      grade: "4th",
      readingLevel: "P",
      role: UserRole.PARENT,
    });
    const urgent = evaluateReadingRisk({
      grade: "4th",
      readingLevel: "M",
      role: UserRole.DISTRICT,
    });

    expect(onTrack.mode).toBe("band");
    expect(onTrack.tone).toBe("good");
    expect(onTrack.label).toBe("On track");

    expect(watch.tone).toBe("warn");
    expect(watch.label).toContain("1 band below");

    expect(urgent.tone).toBe("risk");
    expect(urgent.label).toContain("2+ bands below");
  });

  it("returns neutral when grade or reading level cannot be resolved", () => {
    expect(
      evaluateReadingRisk({
        grade: "K-5",
        readingLevel: "Q",
        role: UserRole.TEACHER,
      }),
    ).toMatchObject({ tone: "neutral", label: "No data" });

    expect(
      evaluateReadingRisk({
        grade: "4th",
        readingLevel: "",
        role: UserRole.TEACHER,
      }),
    ).toMatchObject({ tone: "neutral", label: "No data" });
  });
});
