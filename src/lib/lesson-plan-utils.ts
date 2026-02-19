export type LessonPlanViewFilter = "All" | "My Plans" | "Shared";
export type LessonPlanSort = "Newest" | "Recently Updated" | "Title A-Z";

export type LessonPlanRecord = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  createdDate: string;
  updatedAt?: string;
  author: string;
  ownerId: string;
  isShared: boolean;
  studentGroup?: string[];
  lessonPlan: {
    objective: string;
  };
};

const normalizeSpaces = (value: string): string => value.trim().replace(/\s+/g, " ");

export const normalizeOwnerKey = (value: string | null | undefined): string =>
  value ? normalizeSpaces(value).toLowerCase() : "";

const toMs = (value: string | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const isLessonPlanOwnedBy = (plan: Pick<LessonPlanRecord, "ownerId" | "author">, ownerKey: string): boolean => {
  const normalizedOwner = normalizeOwnerKey(plan.ownerId);
  if (normalizedOwner.length > 0) {
    return normalizedOwner === ownerKey;
  }
  return normalizeOwnerKey(plan.author) === ownerKey;
};

export const matchesLessonPlanSearch = (plan: LessonPlanRecord, query: string): boolean => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const groupSearch = plan.studentGroup?.join(" ").toLowerCase() ?? "";
  return (
    plan.title.toLowerCase().includes(normalized) ||
    plan.lessonPlan.objective.toLowerCase().includes(normalized) ||
    plan.subject.toLowerCase().includes(normalized) ||
    plan.grade.toLowerCase().includes(normalized) ||
    plan.author.toLowerCase().includes(normalized) ||
    groupSearch.includes(normalized)
  );
};

export const isLessonPlanVisible = (
  plan: LessonPlanRecord,
  ownerKey: string,
  viewFilter: LessonPlanViewFilter,
): boolean => {
  const isMine = isLessonPlanOwnedBy(plan, ownerKey);
  const isVisible = isMine || plan.isShared;
  if (!isVisible) return false;
  if (viewFilter === "My Plans" && !isMine) return false;
  if (viewFilter === "Shared" && (!plan.isShared || isMine)) return false;
  return true;
};

export const sortLessonPlans = (plans: LessonPlanRecord[], sortBy: LessonPlanSort): LessonPlanRecord[] => {
  return [...plans].sort((left, right) => {
    if (sortBy === "Title A-Z") {
      return left.title.localeCompare(right.title);
    }
    if (sortBy === "Recently Updated") {
      const leftMs = toMs(left.updatedAt) || toMs(left.createdDate);
      const rightMs = toMs(right.updatedAt) || toMs(right.createdDate);
      return rightMs - leftMs;
    }
    return toMs(right.createdDate) - toMs(left.createdDate);
  });
};

export const areLessonPlansEqual = (left: LessonPlanRecord | null, right: LessonPlanRecord | null): boolean => {
  if (!left || !right) return false;
  return JSON.stringify(left) === JSON.stringify(right);
};
