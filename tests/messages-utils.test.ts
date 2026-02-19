import { describe, expect, it } from "vitest";

import { UserRole, type Conversation } from "../src/types";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  filterConversationsByQuery,
  formatMessageTimeLabel,
  sortConversationsByLastActivity,
  validateAttachment,
} from "../src/lib/messages-utils";

const makeConversation = (overrides: Partial<Conversation>): Conversation => ({
  id: "conv-1",
  participantId: "p-1",
  participantName: "Mrs. Martinez",
  participantRole: UserRole.PARENT,
  participantAvatarSeed: "martinez",
  lastMessage: "",
  lastMessageTime: "",
  unreadCount: 0,
  messages: [],
  ...overrides,
});

describe("messages utils", () => {
  it("sorts conversations by last activity descending", () => {
    const conversations = [
      makeConversation({
        id: "older",
        participantName: "Older",
        messages: [{ id: "m1", senderId: "1", senderName: "Older", content: "A", timestamp: "2026-02-19T08:00:00.000Z", isRead: true, isMe: false }],
      }),
      makeConversation({
        id: "newer",
        participantName: "Newer",
        messages: [{ id: "m2", senderId: "2", senderName: "Newer", content: "B", timestamp: "2026-02-19T09:00:00.000Z", isRead: true, isMe: false }],
      }),
    ];

    const sorted = sortConversationsByLastActivity(conversations);
    expect(sorted.map((c) => c.id)).toEqual(["newer", "older"]);
  });

  it("filters conversations by participant and message text", () => {
    const conversations = [
      makeConversation({
        id: "alpha",
        participantName: "Dr. Evans",
        lastMessage: "Family follow-up complete.",
        messages: [{ id: "m1", senderId: "1", senderName: "Dr. Evans", content: "Family follow-up complete.", timestamp: "2026-02-19T09:00:00.000Z", isRead: true, isMe: false }],
      }),
      makeConversation({
        id: "beta",
        participantName: "Mr. Davis",
        lastMessage: "Schedule update",
        messages: [{ id: "m2", senderId: "2", senderName: "Mr. Davis", content: "Schedule update", timestamp: "2026-02-19T08:00:00.000Z", isRead: true, isMe: false }],
      }),
    ];

    const filteredByName = filterConversationsByQuery(conversations, (c) => c.participantName, "evans");
    const filteredByMessage = filterConversationsByQuery(conversations, (c) => c.participantName, "family follow");

    expect(filteredByName.map((c) => c.id)).toEqual(["alpha"]);
    expect(filteredByMessage.map((c) => c.id)).toEqual(["alpha"]);
  });

  it("formats ISO timestamps into clock labels", () => {
    expect(formatMessageTimeLabel("2026-02-19T08:30:00.000Z")).toMatch(/\d{2}:\d{2}/);
    expect(formatMessageTimeLabel("Just now")).toBe("Just now");
  });

  it("rejects unsupported or oversized attachments", () => {
    const unsupported = new File(["abc"], "notes.csv", { type: "text/csv" });
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" });
    const valid = new File(["hello"], "notes.txt", { type: "text/plain" });

    expect(validateAttachment(unsupported, 0)).toEqual({
      ok: false,
      error: "\"notes.csv\" is not a supported file type.",
    });
    expect(validateAttachment(oversized, 0)).toEqual({
      ok: false,
      error: "\"big.pdf\" is larger than 10 MB.",
    });
    expect(validateAttachment(valid, MAX_ATTACHMENTS_PER_MESSAGE)).toEqual({
      ok: false,
      error: `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.`,
    });
    expect(validateAttachment(valid, 0)).toEqual({ ok: true });
  });
});

