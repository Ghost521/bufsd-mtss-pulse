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

const makeImportRecord = (id: string, label: string) => ({
  id,
  source: "csv",
  status: "completed",
  label,
  importedAt: "2026-03-10T12:00:00.000Z",
  rowCount: 24,
});

type ImportRow = ReturnType<typeof makeImportRecord>;

describe("collection-store imports", () => {
  it("preserves replace ordering through the row-level import store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeImportRecord("imp-2", "Second Import"),
      makeImportRecord("imp-1", "First Import"),
    ];

    await replaceDomainRows(session, "imports", rows);

    const listed = await listDomainRows<ImportRow>(session, "imports");
    expect(listed.map((row) => row.id)).toEqual(["imp-2", "imp-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeImportRecord("imp-legacy", "Legacy Import");

    await writeTenantCollection(tenantKey, "imports", [legacyRow]);

    const imported = await listDomainRows<ImportRow>(session, "imports");
    expect(imported.map((row) => row.id)).toEqual(["imp-legacy"]);

    const deleted = await deleteDomainRow<ImportRow>(session, "imports", "imp-legacy");
    expect(deleted?.id).toBe("imp-legacy");

    const listedAfterDelete = await listDomainRows<ImportRow>(session, "imports");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<ImportRow>(session, "imports", makeImportRecord("temp", "Casey Import"));
    const updated = await updateDomainRow<ImportRow>(session, "imports", created.id, {
      status: "reviewed",
      rowCount: 30,
    });

    const listed = await listDomainRows<ImportRow>(session, "imports");

    expect(updated?.status).toBe("reviewed");
    expect(updated?.rowCount).toBe(30);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
