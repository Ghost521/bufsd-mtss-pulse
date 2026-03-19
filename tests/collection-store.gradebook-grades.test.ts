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

const makeGrade = (id: string, studentId: string, assignmentId: string, score: number | "M" | "E" | "L" | null) => ({
  id,
  studentId,
  assignmentId,
  score,
});

type GradeRow = ReturnType<typeof makeGrade>;

describe("collection-store gradebook grades", () => {
  it("preserves replace ordering through the row-level grade store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeGrade("grade-2", "student-2", "asn-2", 92),
      makeGrade("grade-1", "student-1", "asn-1", 88),
    ];

    await replaceDomainRows(session, "gradebook-grades", rows);

    const listed = await listDomainRows<GradeRow>(session, "gradebook-grades");
    expect(listed.map((row) => row.id)).toEqual(["grade-2", "grade-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeGrade("grade-legacy", "student-legacy", "asn-legacy", 75);

    await writeTenantCollection(tenantKey, "gradebook_grades", [legacyRow]);

    const imported = await listDomainRows<GradeRow>(session, "gradebook-grades");
    expect(imported.map((row) => row.id)).toEqual(["grade-legacy"]);

    const deleted = await deleteDomainRow<GradeRow>(session, "gradebook-grades", "grade-legacy");
    expect(deleted?.id).toBe("grade-legacy");

    const listedAfterDelete = await listDomainRows<GradeRow>(session, "gradebook-grades");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<GradeRow>(
      session,
      "gradebook-grades",
      makeGrade("temp", "student-temp", "asn-temp", 84),
    );
    const updated = await updateDomainRow<GradeRow>(session, "gradebook-grades", created.id, {
      score: 97,
    });

    const listed = await listDomainRows<GradeRow>(session, "gradebook-grades");

    expect(updated?.score).toBe(97);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
