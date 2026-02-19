import { ApprovalStatus, type Conversation, type NotificationRow, type RAGDocument, UserRole } from "../../types";

type ReferralLike = {
  id: string;
  studentName: string;
  type: string;
  urgency: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  grade?: string;
};

type InterventionLike = {
  id: string;
  studentName: string;
  planName?: string;
  status?: string;
  progress?: number;
  startDate?: string;
  teacher?: string;
};

export type NotificationCandidate = Omit<
  NotificationRow,
  "id" | "seenAt" | "readAt" | "dismissedAt" | "archivedAt" | "deletedAt" | "updatedAt"
>;

export type NotificationSourceSnapshot = {
  currentUserId: string;
  currentUserName: string;
  currentRole: UserRole;
  messages: Conversation[];
  referrals: ReferralLike[];
  interventions: InterventionLike[];
  documents: RAGDocument[];
};

const nowIso = (): string => new Date().toISOString();

const toIsoOrNow = (input: string | null | undefined): string => {
  if (!input || input.trim().length === 0) return nowIso();
  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) return nowIso();
  return new Date(parsed).toISOString();
};

const normalize = (value: string | null | undefined): string => value?.trim().toLowerCase() ?? "";

const dedupeCandidates = (candidates: NotificationCandidate[]): NotificationCandidate[] => {
  const seen = new Set<string>();
  const next: NotificationCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.recipientUserId}:${candidate.sourceFingerprint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(candidate);
  }
  return next;
};

const routeForReferral = (role: UserRole): string => {
  if (role === UserRole.DISTRICT || role === UserRole.PARENT) return "reports";
  return "interventions";
};

const messageCandidates = (snapshot: NotificationSourceSnapshot): NotificationCandidate[] => {
  const rows: NotificationCandidate[] = [];
  for (const conversation of snapshot.messages) {
    if (!conversation.unreadCount || conversation.unreadCount <= 0) continue;
    const latestTimestamp =
      conversation.messages[conversation.messages.length - 1]?.timestamp || conversation.lastMessageTime || nowIso();
    const messageCountLabel = conversation.unreadCount === 1 ? "message" : "messages";
    const participant = conversation.participantName || "New sender";
    const latestMessage = conversation.lastMessage?.trim() || "Open Messages to review the latest update.";
    rows.push({
      recipientUserId: snapshot.currentUserId,
      recipientUserName: snapshot.currentUserName,
      title: `${conversation.unreadCount} unread ${messageCountLabel}`,
      summary: `${participant} sent an update.`,
      body: latestMessage,
      category: "Message",
      severity: "info",
      sourceType: "messages",
      sourceId: conversation.id,
      sourceFingerprint: `messages:${conversation.id}:${latestTimestamp}:${conversation.unreadCount}`,
      sourceRoute: "messages",
      sourceContext: {
        participant,
        unreadCount: `${conversation.unreadCount}`,
      },
      createdAt: toIsoOrNow(latestTimestamp),
    });
  }
  return rows;
};

const referralCandidates = (snapshot: NotificationSourceSnapshot): NotificationCandidate[] => {
  const rows: NotificationCandidate[] = [];
  for (const referral of snapshot.referrals) {
    const urgency = normalize(referral.urgency);
    const isHighUrgency = urgency === "high" || urgency === "critical";
    const isPending = normalize(referral.status) === "pending review";
    if (!isHighUrgency && !isPending) continue;

    const severity: NotificationCandidate["severity"] = urgency === "critical" ? "critical" : "warning";
    rows.push({
      recipientUserId: snapshot.currentUserId,
      recipientUserName: snapshot.currentUserName,
      title: `${referral.studentName} referral needs review`,
      summary: `${referral.type} referral · ${referral.urgency} urgency`,
      body: referral.notes?.trim() || "Review this referral and determine the next intervention step.",
      category: "Referral",
      severity,
      sourceType: "referrals",
      sourceId: referral.id,
      sourceFingerprint: `referrals:${referral.id}:${normalize(referral.status)}:${urgency}`,
      sourceRoute: routeForReferral(snapshot.currentRole),
      sourceContext: {
        studentName: referral.studentName,
        urgency: referral.urgency,
        type: referral.type,
        grade: referral.grade ?? "",
      },
      createdAt: toIsoOrNow(referral.createdAt),
    });
  }
  return rows;
};

const interventionCandidates = (snapshot: NotificationSourceSnapshot): NotificationCandidate[] => {
  const rows: NotificationCandidate[] = [];
  for (const intervention of snapshot.interventions) {
    const status = normalize(intervention.status);
    if (status !== "at risk" && status !== "critical") continue;
    const severity: NotificationCandidate["severity"] = status === "critical" ? "critical" : "warning";
    rows.push({
      recipientUserId: snapshot.currentUserId,
      recipientUserName: snapshot.currentUserName,
      title: `${intervention.studentName} intervention is ${intervention.status}`,
      summary: `${intervention.planName ?? "Intervention plan"} requires follow-up.`,
      body: intervention.progress != null
        ? `Current progress is ${Math.max(0, Math.min(100, Math.round(intervention.progress)))}%. Review the intervention timeline and adjust supports.`
        : "Review the intervention timeline and adjust supports.",
      category: "Intervention",
      severity,
      sourceType: "interventions",
      sourceId: intervention.id,
      sourceFingerprint: `interventions:${intervention.id}:${status}:${intervention.progress ?? ""}`,
      sourceRoute: "interventions",
      sourceContext: {
        studentName: intervention.studentName,
        status: intervention.status ?? "",
        teacher: intervention.teacher ?? "",
      },
      createdAt: toIsoOrNow(intervention.startDate),
    });
  }
  return rows;
};

const documentCandidates = (snapshot: NotificationSourceSnapshot): NotificationCandidate[] => {
  const rows: NotificationCandidate[] = [];
  for (const document of snapshot.documents) {
    if (document.status !== ApprovalStatus.PENDING && document.status !== ApprovalStatus.REJECTED) continue;
    const severity: NotificationCandidate["severity"] =
      document.status === ApprovalStatus.REJECTED ? "critical" : "warning";
    const title =
      document.status === ApprovalStatus.REJECTED
        ? `${document.name} was rejected`
        : `${document.name} is awaiting approval`;
    rows.push({
      recipientUserId: snapshot.currentUserId,
      recipientUserName: snapshot.currentUserName,
      title,
      summary: `${document.type.toUpperCase()} · ${document.scope} scope`,
      body:
        document.summary?.trim() ||
        "Open the document workspace to review status details and required next actions.",
      category: "Document",
      severity,
      sourceType: "documents",
      sourceId: document.id,
      sourceFingerprint: `documents:${document.id}:${normalize(document.status)}`,
      sourceRoute: "documents",
      sourceContext: {
        documentName: document.name,
        status: document.status,
        uploader: document.uploaderName,
      },
      createdAt: toIsoOrNow(document.uploadDate),
    });
  }
  return rows;
};

export const buildDerivedNotificationCandidates = (snapshot: NotificationSourceSnapshot): NotificationCandidate[] => {
  const candidates = [
    ...messageCandidates(snapshot),
    ...referralCandidates(snapshot),
    ...interventionCandidates(snapshot),
    ...documentCandidates(snapshot),
  ];
  return dedupeCandidates(candidates);
};

const rowMatchesRecipient = (row: NotificationRow, candidate: NotificationCandidate): boolean =>
  row.recipientUserId === candidate.recipientUserId || normalize(row.recipientUserName) === normalize(candidate.recipientUserName);

const candidateProjectionFromRow = (row: NotificationRow): NotificationCandidate => ({
  recipientUserId: row.recipientUserId,
  recipientUserName: row.recipientUserName,
  title: row.title,
  summary: row.summary,
  body: row.body,
  category: row.category,
  severity: row.severity,
  sourceType: row.sourceType,
  sourceId: row.sourceId,
  sourceFingerprint: row.sourceFingerprint,
  sourceRoute: row.sourceRoute,
  sourceContext: row.sourceContext,
  createdAt: row.createdAt,
});

export const mergeDerivedNotifications = (input: {
  existingRows: NotificationRow[];
  candidates: NotificationCandidate[];
  now?: Date;
}): { rows: NotificationRow[]; changed: boolean } => {
  const now = (input.now ?? new Date()).toISOString();
  const nextRows = [...input.existingRows];
  let changed = false;

  for (const candidate of input.candidates) {
    const existingIndex = nextRows.findIndex(
      (row) => row.sourceFingerprint === candidate.sourceFingerprint && rowMatchesRecipient(row, candidate),
    );

    if (existingIndex >= 0) {
      const existing = nextRows[existingIndex];
      if (existing.deletedAt) continue;
      const existingProjection = candidateProjectionFromRow(existing);
      if (JSON.stringify(existingProjection) === JSON.stringify(candidate)) {
        continue;
      }
      const merged: NotificationRow = {
        ...existing,
        ...candidate,
        updatedAt: now,
      };
      nextRows[existingIndex] = merged;
      changed = true;
      continue;
    }

    const hasDeletedTombstone = nextRows.some(
      (row) =>
        row.sourceFingerprint === candidate.sourceFingerprint &&
        row.recipientUserId === candidate.recipientUserId &&
        Boolean(row.deletedAt),
    );
    if (hasDeletedTombstone) continue;

    const created: NotificationRow = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ...candidate,
      updatedAt: now,
    };
    nextRows.unshift(created);
    changed = true;
  }

  if (!changed) return { rows: input.existingRows, changed: false };

  nextRows.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  return { rows: nextRows, changed: true };
};
