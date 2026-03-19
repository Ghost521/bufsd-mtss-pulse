import { describe, expect, it } from "vitest";
import {
  createDomainRow,
  deleteDomainRow,
  listDomainRows,
  replaceDomainRows,
  updateDomainRow,
} from "../src/lib/server/collection-store";
import { toTenantKey, writeTenantCollection } from "../src/lib/server/persistence";
import { UserRole } from "../src/types";
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

const makeConversation = (id: string, participantName: string) => ({
  id,
  participantId: `participant-${id}`,
  participantName,
  participantRole: UserRole.TEACHER,
  participantAvatarSeed: participantName.replace(/\s+/g, "-").toLowerCase(),
  lastMessage: `Latest update from ${participantName}`,
  lastMessageTime: "2026-03-10T12:00:00.000Z",
  unreadCount: 1,
  messages: [
    {
      id: `msg-${id}-1`,
      senderId: `sender-${id}`,
      senderName: participantName,
      content: `Hello from ${participantName}`,
      timestamp: "2026-03-10T11:45:00.000Z",
      isRead: false,
      isMe: false,
    },
  ],
});

type MessageRow = ReturnType<typeof makeConversation>;

describe("collection-store messages", () => {
  it("preserves replace ordering through the row-level message store", async () => {
    const session = makeSession("replace-order");
    const rows = [
      makeConversation("conv-2", "Jordan Lee"),
      makeConversation("conv-1", "Avery Stone"),
    ];

    await replaceDomainRows(session, "messages", rows);

    const listed = await listDomainRows<MessageRow>(session, "messages");
    expect(listed.map((row) => row.id)).toEqual(["conv-2", "conv-1"]);
  });

  it("imports legacy rows once and clears legacy fallback on last delete", async () => {
    const session = makeSession("legacy-delete");
    const tenantKey = toTenantKey(session.activeContext);
    const legacyRow = makeConversation("conv-legacy", "Legacy Family");

    await writeTenantCollection(tenantKey, "messages", [legacyRow]);

    const imported = await listDomainRows<MessageRow>(session, "messages");
    expect(imported.map((row) => row.id)).toEqual(["conv-legacy"]);

    const deleted = await deleteDomainRow<MessageRow>(session, "messages", "conv-legacy");
    expect(deleted?.id).toBe("conv-legacy");

    const listedAfterDelete = await listDomainRows<MessageRow>(session, "messages");
    expect(listedAfterDelete).toEqual([]);
  });

  it("supports incremental create and patch without bulk rewrite semantics", async () => {
    const session = makeSession("incremental");
    const created = await createDomainRow<MessageRow>(session, "messages", makeConversation("temp", "Casey Brown"));
    const updated = await updateDomainRow<MessageRow>(session, "messages", created.id, {
      lastMessage: "Updated conversation preview",
      unreadCount: 0,
      messages: [
        ...created.messages,
        {
          id: "msg-temp-2",
          senderId: "sender-temp",
          senderName: "Casey Brown",
          content: "Follow-up message",
          timestamp: "2026-03-10T12:30:00.000Z",
          isRead: true,
          isMe: false,
        },
      ],
    });

    const listed = await listDomainRows<MessageRow>(session, "messages");

    expect(updated?.lastMessage).toBe("Updated conversation preview");
    expect(updated?.unreadCount).toBe(0);
    expect(updated?.messages).toHaveLength(2);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
  });
});
