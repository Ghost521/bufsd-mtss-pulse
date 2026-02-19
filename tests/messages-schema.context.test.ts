import { describe, expect, it } from "vitest";

import { conversationRowSchema } from "../src/lib/schemas/data";
import { UserRole } from "../src/types";

const baseConversation = {
  id: "conv-1",
  participantId: "p-1",
  participantName: "Mr. Davis",
  participantRole: UserRole.TEACHER,
  participantAvatarSeed: "mrdavis",
  lastMessage: "Follow-up sent.",
  lastMessageTime: "2026-02-19T10:00:00.000Z",
  unreadCount: 0,
  messages: [
    {
      id: "msg-1",
      senderId: "me",
      senderName: "Rosa Cortese",
      content: "Follow-up sent.",
      timestamp: "2026-02-19T10:00:00.000Z",
      isRead: true,
      isMe: true,
    },
  ],
};

describe("conversation schema context support", () => {
  it("accepts intervention and referral thread context on conversations/messages", () => {
    const parsed = conversationRowSchema.parse({
      ...baseConversation,
      threadContext: {
        type: "intervention",
        studentName: "Jordan Lee",
        interventionId: "plan-8",
        interventionPlanName: "Fluency Support",
      },
      messages: [
        {
          ...baseConversation.messages[0],
          threadContext: {
            type: "referral",
            studentName: "Jordan Lee",
            referralId: "REF-88",
            referralType: "Academic",
            referralUrgency: "High",
          },
        },
      ],
    });

    expect(parsed.threadContext?.type).toBe("intervention");
    expect(parsed.messages[0].threadContext?.type).toBe("referral");
  });

  it("rejects unsupported referral urgency values", () => {
    const result = conversationRowSchema.safeParse({
      ...baseConversation,
      threadContext: {
        type: "referral",
        studentName: "Jordan Lee",
        referralUrgency: "Urgent",
      },
    });

    expect(result.success).toBe(false);
  });
});
