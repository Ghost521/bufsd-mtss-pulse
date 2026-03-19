import { describe, expect, it } from "vitest";
import {
  createDomainRow,
  deleteDomainRow,
  listDomainRows,
  replaceDomainRows,
  updateDomainRow,
} from "../src/lib/server/collection-store";
import { toTenantKey, writeTenantCollection } from "../src/lib/server/persistence";
import { ApprovalStatus, DocumentScope, UserRole } from "../src/types";
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

const makeDocument = (id: string, name: string) => ({
  id,
  name,
  type: "PDF",
  uploadDate: "2026-03-10T12:00:00.000Z",
  uploaderName: "Jordan Lee",
  uploaderRole: UserRole.PRINCIPAL,
  scope: DocumentScope.SCHOOL,
  status: ApprovalStatus.PENDING,
  summary: `${name} summary`,
  size: "2 MB",
  uri: `https://example.com/${id}.pdf`,
  mimeType: "application/pdf",
});

type DocumentRow = ReturnType<typeof makeDocument>;

describe("collection-store documents", () => {
  it("preserves replace ordering through the row-level document store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeDocument("doc-2", "Second Document"),
      makeDocument("doc-1", "First Document"),
    ];

    await replaceDomainRows(session, "documents", rows);

    const listed = await listDomainRows<DocumentRow>(session, "documents");
    expect(listed.map((row) => row.id)).toEqual(["doc-2", "doc-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeDocument("doc-legacy", "Legacy Document");

    await writeTenantCollection(tenantKey, "documents", [legacyRow]);

    const imported = await listDomainRows<DocumentRow>(session, "documents");
    expect(imported.map((row) => row.id)).toEqual(["doc-legacy"]);

    const deleted = await deleteDomainRow<DocumentRow>(session, "documents", "doc-legacy");
    expect(deleted?.id).toBe("doc-legacy");

    const listedAfterDelete = await listDomainRows<DocumentRow>(session, "documents");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<DocumentRow>(session, "documents", makeDocument("temp", "Casey Packet"));
    const updated = await updateDomainRow<DocumentRow>(session, "documents", created.id, {
      status: ApprovalStatus.APPROVED,
      summary: "Updated approval summary",
    });

    const listed = await listDomainRows<DocumentRow>(session, "documents");

    expect(updated?.status).toBe(ApprovalStatus.APPROVED);
    expect(updated?.summary).toBe("Updated approval summary");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
