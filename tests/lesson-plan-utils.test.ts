import { describe, expect, it } from "vitest";

import {
  areLessonPlansEqual,
  isLessonPlanOwnedBy,
  isLessonPlanVisible,
  matchesLessonPlanSearch,
  normalizeOwnerKey,
  sortLessonPlans,
  type LessonPlanRecord,
} from "../src/lib/lesson-plan-utils";

const buildPlan = (overrides: Partial<LessonPlanRecord>): LessonPlanRecord => ({
  id: "plan-1",
  title: "Fraction Foundations",
  subject: "Math",
  grade: "4th",
  createdDate: "2026-02-10T12:00:00.000Z",
  updatedAt: "2026-02-11T12:00:00.000Z",
  author: "Rosa Cortese",
  ownerId: "Rosa Cortese",
  isShared: false,
  studentGroup: ["Jordan Lee", "Ava Patel"],
  lessonPlan: {
    objective: "Students explain equivalent fractions.",
  },
  ...overrides,
});

describe("lesson-plan-utils", () => {
  it("normalizes ownership keys consistently", () => {
    expect(normalizeOwnerKey("  Rosa   Cortese ")).toBe("rosa cortese");
    expect(normalizeOwnerKey(undefined)).toBe("");
  });

  it("resolves ownership from ownerId and author fallback", () => {
    const ownerKey = normalizeOwnerKey("Rosa Cortese");
    const planWithOwner = buildPlan({});
    const planWithAuthorOnly = buildPlan({ ownerId: "", author: "Rosa Cortese" });
    expect(isLessonPlanOwnedBy(planWithOwner, ownerKey)).toBe(true);
    expect(isLessonPlanOwnedBy(planWithAuthorOnly, ownerKey)).toBe(true);
  });

  it("filters visibility by view type", () => {
    const ownerKey = normalizeOwnerKey("Rosa Cortese");
    const mine = buildPlan({ id: "mine", isShared: false });
    const shared = buildPlan({ id: "shared", ownerId: "Mr. Davis", author: "Mr. Davis", isShared: true });
    const privateOther = buildPlan({ id: "other", ownerId: "Mr. Davis", author: "Mr. Davis", isShared: false });

    expect(isLessonPlanVisible(mine, ownerKey, "All")).toBe(true);
    expect(isLessonPlanVisible(shared, ownerKey, "All")).toBe(true);
    expect(isLessonPlanVisible(privateOther, ownerKey, "All")).toBe(false);
    expect(isLessonPlanVisible(mine, ownerKey, "My Plans")).toBe(true);
    expect(isLessonPlanVisible(shared, ownerKey, "Shared")).toBe(true);
    expect(isLessonPlanVisible(mine, ownerKey, "Shared")).toBe(false);
  });

  it("allows elevated viewers to see private non-owned plans", () => {
    const ownerKey = normalizeOwnerKey("Rosa Cortese");
    const privateOther = buildPlan({ id: "other", ownerId: "Mr. Davis", author: "Mr. Davis", isShared: false });

    expect(isLessonPlanVisible(privateOther, ownerKey, "All")).toBe(false);
    expect(isLessonPlanVisible(privateOther, ownerKey, "All", true)).toBe(true);
  });

  it("matches search across key fields", () => {
    const plan = buildPlan({ title: "Reading Fluency Sprint", subject: "Reading" });
    expect(matchesLessonPlanSearch(plan, "fluency")).toBe(true);
    expect(matchesLessonPlanSearch(plan, "jordan")).toBe(true);
    expect(matchesLessonPlanSearch(plan, "reading")).toBe(true);
    expect(matchesLessonPlanSearch(plan, "missing-term")).toBe(false);
  });

  it("sorts plans by selected sort mode", () => {
    const plans = [
      buildPlan({ id: "b", title: "B Plan", createdDate: "2026-02-01T12:00:00.000Z", updatedAt: "2026-02-02T12:00:00.000Z" }),
      buildPlan({ id: "a", title: "A Plan", createdDate: "2026-02-05T12:00:00.000Z", updatedAt: "2026-02-06T12:00:00.000Z" }),
    ];
    expect(sortLessonPlans(plans, "Newest").map((plan) => plan.id)).toEqual(["a", "b"]);
    expect(sortLessonPlans(plans, "Recently Updated").map((plan) => plan.id)).toEqual(["a", "b"]);
    expect(sortLessonPlans(plans, "Title A-Z").map((plan) => plan.id)).toEqual(["a", "b"]);
  });

  it("detects edited differences", () => {
    const planA = buildPlan({});
    const sameAsA = buildPlan({});
    const planB = buildPlan({ title: "Updated Title" });
    expect(areLessonPlansEqual(planA, sameAsA)).toBe(true);
    expect(areLessonPlansEqual(planA, planB)).toBe(false);
  });
});
