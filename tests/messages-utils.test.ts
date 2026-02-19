import { describe, expect, it } from "vitest";

import { UserRole, type Conversation } from "../src/types";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  conversationMatchesContextFilter,
  filterConversationsByQuery,
  formatMessageTimeLabel,
  sortConversationsByLastActivity,
  summarizeThreadContext,
  toLaunchContextSignature,
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

  it("matches conversations by context filter", () => {
    const interventionConvo = makeConversation({
      id: "intervention",
      threadContext: {
        type: "intervention",
        studentName: "Jordan Lee",
        interventionId: "plan-1",
        interventionPlanName: "Fluency Support",
      },
    });
    const referralConvo = makeConversation({
      id: "referral",
      threadContext: {
        type: "referral",
        studentName: "Avery Park",
        referralId: "REF-12",
        referralType: "Behavior",
        referralUrgency: "High",
      },
    });

    expect(conversationMatchesContextFilter(interventionConvo, "all")).toBe(true);
    expect(conversationMatchesContextFilter(interventionConvo, "intervention")).toBe(true);
    expect(conversationMatchesContextFilter(interventionConvo, "referral")).toBe(false);
    expect(conversationMatchesContextFilter(referralConvo, "referral")).toBe(true);
  });

  it("summarizes thread context for chips", () => {
    expect(
      summarizeThreadContext({
        type: "intervention",
        studentName: "Jordan Lee",
        interventionPlanName: "Fluency Support",
      }),
    ).toBe("Intervention - Fluency Support");

    expect(
      summarizeThreadContext({
        type: "referral",
        studentName: "Avery Park",
        referralId: "REF-19",
        referralUrgency: "Critical",
      }),
    ).toBe("Referral - REF-19 - Critical");
  });

  it("generates stable launch context signatures", () => {
    const signatureA = toLaunchContextSignature({
      recipientName: "Mr. Davis",
      draft: "Please review this intervention.",
      context: {
        type: "intervention",
        studentName: "Jordan Lee",
        interventionId: "plan-1",
      },
    });
    const signatureB = toLaunchContextSignature({
      recipientName: "Mr. Davis",
      draft: "Please review this intervention.",
      context: {
        type: "intervention",
        studentName: "Jordan Lee",
        interventionId: "plan-2",
      },
    });

    expect(signatureA).not.toBe("");
    expect(signatureA).not.toBe(signatureB);
  });

  it("includes multi-recipient launch details in signatures", () => {
    const signatureA = toLaunchContextSignature({
      recipientNames: ["Rosa Cortese", "Mr. Davis"],
      recipientRolesByName: {
        "Mr. Davis": UserRole.TEACHER,
        "Rosa Cortese": UserRole.PRINCIPAL,
      },
      context: {
        type: "intervention",
        studentName: "Jordan Lee",
        interventionId: "plan-1",
      },
    });

    const signatureB = toLaunchContextSignature({
      recipientNames: ["Mr. Davis"],
      recipientRolesByName: {
        "Mr. Davis": UserRole.TEACHER,
      },
      context: {
        type: "intervention",
        studentName: "Jordan Lee",
        interventionId: "plan-1",
      },
    });

    expect(signatureA).not.toBe(signatureB);
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
