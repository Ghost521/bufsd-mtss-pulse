import { describe, expect, it } from "vitest";
import { mergeDerivedNotifications, type NotificationCandidate } from "../src/lib/notifications/notification-engine";
import type { NotificationRow } from "../src/types";

const baseCandidate: NotificationCandidate = {
  recipientUserId: "user-1",
  recipientUserName: "MTSS User",
  title: "1 unread message",
  summary: "Family update available",
  body: "Open Messages to review the latest update.",
  category: "Message",
  severity: "info",
  sourceType: "messages",
  sourceId: "conv-1",
  sourceFingerprint: "messages:conv-1:2026-02-19T00:00:00.000Z:1",
  sourceRoute: "messages",
  sourceContext: {
    participant: "Parent",
    unreadCount: "1",
  },
  createdAt: "2026-02-19T00:00:00.000Z",
};

const toRow = (overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  id: "notif-1",
  ...baseCandidate,
  seenAt: "2026-02-19T00:10:00.000Z",
  readAt: "2026-02-19T00:10:00.000Z",
  updatedAt: "2026-02-19T00:10:00.000Z",
  ...overrides,
});

describe("mergeDerivedNotifications", () => {
  it("does not report changes when candidate payload is unchanged", () => {
    const existingRows = [toRow()];
    const result = mergeDerivedNotifications({
      existingRows,
      candidates: [baseCandidate],
      now: new Date("2026-02-19T01:00:00.000Z"),
    });

    expect(result.changed).toBe(false);
    expect(result.rows).toBe(existingRows);
  });

  it("updates existing derived row only when candidate payload changes", () => {
    const existingRows = [toRow()];
    const updatedCandidate: NotificationCandidate = {
      ...baseCandidate,
      summary: "Family follow-up required",
    };

    const result = mergeDerivedNotifications({
      existingRows,
      candidates: [updatedCandidate],
      now: new Date("2026-02-19T01:00:00.000Z"),
    });

    expect(result.changed).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].summary).toBe("Family follow-up required");
    expect(result.rows[0].seenAt).toBe(existingRows[0].seenAt);
    expect(result.rows[0].updatedAt).toBe("2026-02-19T01:00:00.000Z");
  });
});
