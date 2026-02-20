import { describe, expect, it } from "vitest";
import { Tier } from "../src/types";
import { buildStudentProfileRecord, syncProfileWithRoster } from "../src/lib/student-profile-record";

describe("student profile record", () => {
  it("seeds academic progress with separate math and reading scores", () => {
    const profile = buildStudentProfileRecord({
      id: "stu-1",
      name: "Sample Student",
      grade: "4th",
      tier: Tier.TIER_2,
      gpa: "3.1",
      attendance: 94,
      readingLevel: "M",
      alerts: 1,
      teacher: "Ms. Lee",
    });

    expect(profile.academicProgress.length).toBeGreaterThanOrEqual(6);
    expect(profile.academicProgress.every((point) => Number.isFinite(point.mathScore))).toBe(true);
    expect(profile.academicProgress.every((point) => Number.isFinite(point.readingScore))).toBe(true);
    expect(profile.academicProgress.every((point) => point.mathScore >= 0 && point.mathScore <= 100)).toBe(true);
    expect(profile.academicProgress.every((point) => point.readingScore >= 0 && point.readingScore <= 100)).toBe(true);
  });

  it("normalizes missing academic progress during roster sync", () => {
    const seeded = buildStudentProfileRecord({
      id: "stu-2",
      name: "Another Student",
      grade: "5th",
      tier: Tier.TIER_1,
      gpa: "3.7",
      attendance: 97,
      readingLevel: "R",
      alerts: 0,
      teacher: "Mr. Ortiz",
    });

    const legacyLikeProfile = {
      ...seeded,
      academicProgress: undefined,
    } as unknown as typeof seeded;

    const synced = syncProfileWithRoster(legacyLikeProfile, {
      id: "stu-2",
      name: "Another Student",
      grade: "5th",
      tier: Tier.TIER_1,
      gpa: "3.7",
      attendance: 97,
      readingLevel: "R",
      alerts: 0,
      teacher: "Mr. Ortiz",
    });

    expect(synced.academicProgress).toEqual([]);
  });
});

