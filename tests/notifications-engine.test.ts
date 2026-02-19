import { describe, expect, it } from "vitest";

import { ApprovalStatus, DocumentScope, UserRole, type NotificationRow } from "../src/types";
import { buildDerivedNotificationCandidates, mergeDerivedNotifications } from "../src/lib/notifications/notification-engine";

describe("notification engine", () => {
  it("builds candidates from existing source domains", () => {
    const candidates = buildDerivedNotificationCandidates({
      currentUserId: "u-principal-ne",
      currentUserName: "Rosa Cortese",
      currentRole: UserRole.PRINCIPAL,
      messages: [
        {
          id: "conv-1",
          participantId: "p-1",
          participantName: "Mr. Davis",
          participantRole: UserRole.TEACHER,
          participantAvatarSeed: "mrdavis",
          lastMessage: "Can we review this plan?",
          lastMessageTime: "2026-02-19T10:00:00.000Z",
          unreadCount: 2,
          messages: [],
        },
      ],
      referrals: [
        {
          id: "ref-1",
          studentName: "Jordan Lee",
          type: "Academic",
          urgency: "High",
          status: "Pending Review",
          notes: "Needs reading intervention support.",
          createdAt: "2026-02-19T09:00:00.000Z",
          grade: "4",
        },
      ],
      interventions: [
        {
          id: "int-1",
          studentName: "Jordan Lee",
          planName: "Fluency Boost",
          status: "Critical",
          progress: 28,
          startDate: "2026-02-01T00:00:00.000Z",
          teacher: "Mr. Davis",
        },
      ],
      documents: [
        {
          id: "doc-1",
          name: "Intervention Notes",
          type: "pdf",
          uploadDate: "2026-02-18T12:00:00.000Z",
          uploaderName: "Rosa Cortese",
          uploaderRole: UserRole.PRINCIPAL,
          scope: DocumentScope.SCHOOL,
          status: ApprovalStatus.PENDING,
        },
      ],
    });

    expect(candidates.length).toBeGreaterThanOrEqual(4);
    expect(candidates.some((candidate) => candidate.sourceType === "messages")).toBe(true);
    expect(candidates.some((candidate) => candidate.sourceType === "referrals")).toBe(true);
    expect(candidates.some((candidate) => candidate.sourceType === "interventions")).toBe(true);
    expect(candidates.some((candidate) => candidate.sourceType === "documents")).toBe(true);
  });

  it("merges candidates without duplicating and respects deleted tombstones", () => {
    const existing: NotificationRow[] = [
      {
        id: "n-existing",
        recipientUserId: "u-principal-ne",
        recipientUserName: "Rosa Cortese",
        title: "Old",
        summary: "Old summary",
        body: "Old body",
        category: "Message",
        severity: "info",
        sourceType: "messages",
        sourceId: "conv-1",
        sourceFingerprint: "messages:conv-1:ts:2",
        sourceRoute: "messages",
        sourceContext: { unreadCount: "2" },
        createdAt: "2026-02-19T10:00:00.000Z",
        updatedAt: "2026-02-19T10:00:00.000Z",
      },
      {
        id: "n-deleted",
        recipientUserId: "u-principal-ne",
        recipientUserName: "Rosa Cortese",
        title: "Deleted",
        summary: "Deleted summary",
        body: "Deleted body",
        category: "Referral",
        severity: "warning",
        sourceType: "referrals",
        sourceId: "ref-1",
        sourceFingerprint: "referrals:ref-1:pending review:high",
        sourceRoute: "interventions",
        sourceContext: {},
        createdAt: "2026-02-19T09:00:00.000Z",
        deletedAt: "2026-02-19T09:10:00.000Z",
        updatedAt: "2026-02-19T09:10:00.000Z",
      },
    ];

    const merged = mergeDerivedNotifications({
      existingRows: existing,
      candidates: [
        {
          recipientUserId: "u-principal-ne",
          recipientUserName: "Rosa Cortese",
          title: "Updated unread",
          summary: "Mr. Davis sent an update.",
          body: "Please review.",
          category: "Message",
          severity: "info",
          sourceType: "messages",
          sourceId: "conv-1",
          sourceFingerprint: "messages:conv-1:ts:2",
          sourceRoute: "messages",
          sourceContext: { unreadCount: "2" },
          createdAt: "2026-02-19T10:00:00.000Z",
        },
        {
          recipientUserId: "u-principal-ne",
          recipientUserName: "Rosa Cortese",
          title: "Should not resurrect",
          summary: "Referral still pending",
          body: "Should be ignored because deleted tombstone exists.",
          category: "Referral",
          severity: "warning",
          sourceType: "referrals",
          sourceId: "ref-1",
          sourceFingerprint: "referrals:ref-1:pending review:high",
          sourceRoute: "interventions",
          sourceContext: {},
          createdAt: "2026-02-19T09:00:00.000Z",
        },
      ],
    });

    expect(merged.changed).toBe(true);
    expect(merged.rows.filter((row) => row.sourceFingerprint === "messages:conv-1:ts:2")).toHaveLength(1);
    expect(merged.rows.filter((row) => row.sourceFingerprint === "referrals:ref-1:pending review:high")).toHaveLength(1);
    expect(
      merged.rows.find((row) => row.sourceFingerprint === "referrals:ref-1:pending review:high")?.deletedAt,
    ).toBeTruthy();
  });
});
