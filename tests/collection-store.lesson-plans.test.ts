import { describe, expect, it } from "vitest";
import {
  createDomainRow,
  deleteDomainRow,
  listDomainRows,
  replaceDomainRows,
  updateDomainRow,
} from "../src/lib/server/collection-store";
import { toTenantKey, writeTenantCollection } from "../src/lib/server/persistence";
import type { SessionContext } from "../src/lib/server/tenant-types";

const makeSession = (seed: string): SessionContext => ({
  user: {
    id: `user-${seed}`,
    name: "Test User",
    email: `test-${seed}@example.com`,
    primaryRole: "principal",
  },
  memberships: [],
  groups: [],
  activeContext: {
    organizationId: `org-${seed}`,
    districtId: `district-${seed}`,
    schoolId: `school-${seed}`,
  },
  effectiveRoles: ["principal"],
});

const makeLessonPlan = (id: string, title: string) => ({
  id,
  title,
  strategy: `${title} strategy`,
  frequency: "Daily",
  duration: "30 minutes",
  monitoringMethod: "Weekly rubric review",
  baseline: 55,
  goal: 80,
  lessonPlan: {
    objective: `${title} objective`,
    materials: ["Student journals"],
    procedure: ["Warm-up", "Guided practice"],
    assessment: "Exit ticket",
    differentiation: "Small-group support",
  },
  subject: "ELA",
  grade: "4",
  createdDate: "2026-03-10",
  updatedAt: "2026-03-10T12:00:00.000Z",
  author: "Ms. Lee",
  ownerId: "teacher-1",
  isShared: true,
  studentGroup: ["Jordan Lee"],
  schoolName: "North Elementary",
});

type LessonPlanRow = ReturnType<typeof makeLessonPlan>;

describe("collection-store lesson plans", () => {
  it("preserves replace ordering through the row-level lesson plan store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeLessonPlan("plan-2", "Second Plan"),
      makeLessonPlan("plan-1", "First Plan"),
    ];

    await replaceDomainRows(session, "lesson-plans", rows);

    const listed = await listDomainRows<LessonPlanRow>(session, "lesson-plans");
    expect(listed.map((row) => row.id)).toEqual(["plan-2", "plan-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeLessonPlan("plan-legacy", "Legacy Plan");

    await writeTenantCollection(tenantKey, "lesson_plans", [legacyRow]);

    const imported = await listDomainRows<LessonPlanRow>(session, "lesson-plans");
    expect(imported.map((row) => row.id)).toEqual(["plan-legacy"]);

    const deleted = await deleteDomainRow<LessonPlanRow>(session, "lesson-plans", "plan-legacy");
    expect(deleted?.id).toBe("plan-legacy");

    const listedAfterDelete = await listDomainRows<LessonPlanRow>(session, "lesson-plans");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<LessonPlanRow>(session, "lesson-plans", makeLessonPlan("temp", "Casey Plan"));
    const updated = await updateDomainRow<LessonPlanRow>(session, "lesson-plans", created.id, {
      title: "Updated Plan",
      isShared: false,
      updatedAt: "2026-03-11T09:00:00.000Z",
    });

    const listed = await listDomainRows<LessonPlanRow>(session, "lesson-plans");

    expect(updated?.title).toBe("Updated Plan");
    expect(updated?.isShared).toBe(false);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
