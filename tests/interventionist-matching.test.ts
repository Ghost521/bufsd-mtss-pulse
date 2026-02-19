import { describe, expect, it } from "vitest";

import { getInterventionistRecipients, normalizeInterventionFocus, resolveInterventionFocus } from "../src/lib/interventionists";
import type { StaffRosterItem } from "../src/types";

const staffRows: StaffRosterItem[] = [
  {
    id: "t-1",
    name: "Mr. Davis",
    role: "Teacher",
    isInterventionist: true,
    interventionFocus: ["Reading"],
    grade: "4th",
    studentCount: 24,
    attendanceRate: 95,
    performanceMetric: "82% Reading Proficiency",
    mtssFidelityScore: 90,
    activeInterventions: 4,
    flaggedStudents: 2,
    avatarSeed: "mr-davis",
  },
  {
    id: "t-2",
    name: "Mrs. Johnson",
    role: "Teacher",
    isInterventionist: true,
    interventionFocus: ["Math"],
    grade: "3rd",
    studentCount: 22,
    attendanceRate: 92,
    performanceMetric: "78% Math Proficiency",
    mtssFidelityScore: 88,
    activeInterventions: 6,
    flaggedStudents: 3,
    avatarSeed: "mrs-johnson",
  },
  {
    id: "s-1",
    name: "Ms. Lee",
    role: "Specialist",
    isInterventionist: true,
    interventionFocus: ["Reading"],
    grade: "K-2",
    studentCount: 12,
    attendanceRate: 94,
    performanceMetric: "Intervention support",
    mtssFidelityScore: 93,
    activeInterventions: 8,
    flaggedStudents: 1,
    avatarSeed: "ms-lee",
  },
  {
    id: "t-3",
    name: "Ms. Green",
    role: "Teacher",
    isInterventionist: true,
    grade: "5th",
    studentCount: 20,
    attendanceRate: 93,
    performanceMetric: "Intervention support",
    mtssFidelityScore: 89,
    activeInterventions: 5,
    flaggedStudents: 2,
    avatarSeed: "ms-green",
  },
];

describe("interventionist matching", () => {
  it("normalizes focus values and removes unsupported entries", () => {
    expect(normalizeInterventionFocus(["Reading", "Math", "Other"])).toEqual(["Math", "Reading"]);
  });

  it("resolves explicit focus from focus area", () => {
    expect(resolveInterventionFocus({ focusArea: "Reading Comprehension" })).toEqual(["Reading"]);
    expect(resolveInterventionFocus({ focusArea: "Math Fluency" })).toEqual(["Math", "Reading"]);
  });

  it("falls back to keyword inference and defaults to both when ambiguous", () => {
    expect(resolveInterventionFocus({ planName: "Number sense boost" })).toEqual(["Math"]);
    expect(resolveInterventionFocus({ planName: "Tier 2 support", note: "Weekly check-in" })).toEqual(["Math", "Reading"]);
  });

  it("returns teacher interventionists that match resolved focus", () => {
    expect(getInterventionistRecipients(staffRows, ["Reading"])).toEqual(["Mr. Davis", "Ms. Green"]);
    expect(getInterventionistRecipients(staffRows, ["Math"])).toEqual(["Mrs. Johnson", "Ms. Green"]);
    expect(getInterventionistRecipients(staffRows, ["Math", "Reading"])).toEqual([
      "Mr. Davis",
      "Mrs. Johnson",
      "Ms. Green",
    ]);
  });
});
