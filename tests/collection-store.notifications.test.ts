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

const makeNotification = (id: string, title: string) => ({
  id,
  recipientUserId: "user-target",
  recipientUserName: "Jordan Lee",
  title,
  summary: `${title} summary`,
  body: `${title} body content`,
  category: "Message" as const,
  severity: "info" as const,
  sourceType: "messages" as const,
  sourceId: `source-${id}`,
  sourceFingerprint: `fingerprint-${id}`,
  sourceRoute: "messages",
  sourceContext: {
    threadId: `thread-${id}`,
  },
  createdAt: "2026-03-10T12:00:00.000Z",
  updatedAt: "2026-03-10T12:00:00.000Z",
});

type NotificationRow = ReturnType<typeof makeNotification>;

describe("collection-store notifications", () => {
  it("preserves replace ordering through the row-level notification store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeNotification("note-2", "Second Notification"),
      makeNotification("note-1", "First Notification"),
    ];

    await replaceDomainRows(session, "notifications", rows);

    const listed = await listDomainRows<NotificationRow>(session, "notifications");
    expect(listed.map((row) => row.id)).toEqual(["note-2", "note-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeNotification("note-legacy", "Legacy Notification");

    await writeTenantCollection(tenantKey, "notifications", [legacyRow]);

    const imported = await listDomainRows<NotificationRow>(session, "notifications");
    expect(imported.map((row) => row.id)).toEqual(["note-legacy"]);

    const deleted = await deleteDomainRow<NotificationRow>(session, "notifications", "note-legacy");
    expect(deleted?.id).toBe("note-legacy");

    const listedAfterDelete = await listDomainRows<NotificationRow>(session, "notifications");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<NotificationRow>(session, "notifications", makeNotification("temp", "Casey Update"));
    const updated = await updateDomainRow<NotificationRow>(session, "notifications", created.id, {
      title: "Updated Title",
      summary: "Updated summary",
      updatedAt: "2026-03-10T13:00:00.000Z",
    });

    const listed = await listDomainRows<NotificationRow>(session, "notifications");

    expect(updated?.title).toBe("Updated Title");
    expect(updated?.summary).toBe("Updated summary");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
