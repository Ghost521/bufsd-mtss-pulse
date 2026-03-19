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

const makeAssignment = (id: string, title: string) => ({
  id,
  title,
  date: "2026-03-10",
  type: "Quiz" as const,
  maxPoints: 100,
  subject: "Math",
  description: `${title} description`,
});

type AssignmentRow = ReturnType<typeof makeAssignment>;

describe("collection-store gradebook assignments", () => {
  it("preserves replace ordering through the row-level assignment store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeAssignment("asn-2", "Second Assignment"),
      makeAssignment("asn-1", "First Assignment"),
    ];

    await replaceDomainRows(session, "gradebook-assignments", rows);

    const listed = await listDomainRows<AssignmentRow>(session, "gradebook-assignments");
    expect(listed.map((row) => row.id)).toEqual(["asn-2", "asn-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeAssignment("asn-legacy", "Legacy Assignment");

    await writeTenantCollection(tenantKey, "gradebook_assignments", [legacyRow]);

    const imported = await listDomainRows<AssignmentRow>(session, "gradebook-assignments");
    expect(imported.map((row) => row.id)).toEqual(["asn-legacy"]);

    const deleted = await deleteDomainRow<AssignmentRow>(session, "gradebook-assignments", "asn-legacy");
    expect(deleted?.id).toBe("asn-legacy");

    const listedAfterDelete = await listDomainRows<AssignmentRow>(session, "gradebook-assignments");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<AssignmentRow>(
      session,
      "gradebook-assignments",
      makeAssignment("temp", "Casey Quiz"),
    );
    const updated = await updateDomainRow<AssignmentRow>(session, "gradebook-assignments", created.id, {
      title: "Updated Quiz",
      maxPoints: 120,
    });

    const listed = await listDomainRows<AssignmentRow>(session, "gradebook-assignments");

    expect(updated?.title).toBe("Updated Quiz");
    expect(updated?.maxPoints).toBe(120);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
