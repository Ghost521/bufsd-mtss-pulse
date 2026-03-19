import { describe, expect, it } from "vitest";
import {
  createDomainRow,
  deleteDomainRow,
  listDomainRows,
  replaceDomainRows,
  updateDomainRow,
} from "../src/lib/server/collection-store";
import { toTenantKey, writeTenantCollection } from "../src/lib/server/persistence";
import { Tier } from "../src/types";
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

const makeStudentProfile = (id: string, name: string) => ({
  id,
  name,
  grade: "4th",
  teacher: "Ms. Lee",
  tier: Tier.TIER_2,
  attendance: 94,
  gpa: "3.2",
  readingLevel: "M",
  interventions: [],
  recentActivity: [],
  academicProgress: [],
  readingAssessments: [],
  notes: [],
  aiRecommendations: [],
  medical: {
    allergies: [],
    medications: [],
    visionScreening: {
      status: "Pass" as const,
      date: "2026-03-10",
    },
    hearingScreening: {
      status: "Pass" as const,
      date: "2026-03-10",
    },
    conditions: [],
  },
  support: {
    planType: "None" as const,
    accommodations: [],
    behavioralStrategies: [],
  },
  updatedAt: "2026-03-10T12:00:00.000Z",
});

type StudentProfileRow = ReturnType<typeof makeStudentProfile>;

describe("collection-store student profiles", () => {
  it("preserves replace ordering through the row-level student profile store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeStudentProfile("stu-2", "Jordan Lee"),
      makeStudentProfile("stu-1", "Avery Stone"),
    ];

    await replaceDomainRows(session, "student-profiles", rows);

    const listed = await listDomainRows<StudentProfileRow>(session, "student-profiles");
    expect(listed.map((row) => row.id)).toEqual(["stu-2", "stu-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeStudentProfile("stu-legacy", "Legacy Student");

    await writeTenantCollection(tenantKey, "student_profiles", [legacyRow]);

    const imported = await listDomainRows<StudentProfileRow>(session, "student-profiles");
    expect(imported.map((row) => row.id)).toEqual(["stu-legacy"]);

    const deleted = await deleteDomainRow<StudentProfileRow>(session, "student-profiles", "stu-legacy");
    expect(deleted?.id).toBe("stu-legacy");

    const listedAfterDelete = await listDomainRows<StudentProfileRow>(session, "student-profiles");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<StudentProfileRow>(
      session,
      "student-profiles",
      makeStudentProfile("temp", "Casey Brown"),
    );
    const updated = await updateDomainRow<StudentProfileRow>(session, "student-profiles", created.id, {
      attendance: 97,
      gpa: "3.8",
      updatedAt: "2026-03-11T09:00:00.000Z",
    });

    const listed = await listDomainRows<StudentProfileRow>(session, "student-profiles");

    expect(updated?.attendance).toBe(97);
    expect(updated?.gpa).toBe("3.8");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
