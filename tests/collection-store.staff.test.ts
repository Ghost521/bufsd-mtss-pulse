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

const makeStaff = (id: string, name: string) => ({
  id,
  name,
  role: "Teacher" as const,
  isInterventionist: true,
  interventionFocus: ["Math"] as Array<"Math" | "Reading">,
  grade: "4",
  studentCount: 24,
  attendanceRate: 96,
  performanceMetric: "Strong student growth",
  mtssFidelityScore: 91,
  activeInterventions: 3,
  flaggedStudents: 1,
  avatarSeed: name.replace(/\s+/g, "-").toLowerCase(),
});

type StaffRow = ReturnType<typeof makeStaff>;

describe("collection-store staff", () => {
  it("preserves replace ordering through the row-level staff store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeStaff("staff-2", "Jordan Lee"),
      makeStaff("staff-1", "Avery Stone"),
    ];

    await replaceDomainRows(session, "staff", rows);

    const listed = await listDomainRows<StaffRow>(session, "staff");
    expect(listed.map((row) => row.id)).toEqual(["staff-2", "staff-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeStaff("staff-legacy", "Legacy Staff");

    await writeTenantCollection(tenantKey, "staff", [legacyRow]);

    const imported = await listDomainRows<StaffRow>(session, "staff");
    expect(imported.map((row) => row.id)).toEqual(["staff-legacy"]);

    const deleted = await deleteDomainRow<StaffRow>(session, "staff", "staff-legacy");
    expect(deleted?.id).toBe("staff-legacy");

    const listedAfterDelete = await listDomainRows<StaffRow>(session, "staff");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<StaffRow>(session, "staff", makeStaff("temp", "Casey Brown"));
    const updated = await updateDomainRow<StaffRow>(session, "staff", created.id, {
      grade: "5",
      activeInterventions: 5,
    });

    const listed = await listDomainRows<StaffRow>(session, "staff");

    expect(updated?.grade).toBe("5");
    expect(updated?.activeInterventions).toBe(5);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
