import type { Conversation, MessageThreadContext, MessagesLaunchContext } from "../types";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 8;

const ALLOWED_MIME_PREFIXES = ["image/"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const canParseDate = (value: string): number | null => {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseClockText = (value: string): number | null => {
  const match = value.match(/^(\d{1,2}):(\d{2})(?:\s?(AM|PM))?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour < 12) hour += 12;
  if (hour > 23 || minute > 59) return null;

  const now = new Date();
  now.setHours(hour, minute, 0, 0);
  return now.getTime();
};

export const getMessageTimeMs = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsedDate = canParseDate(value);
  if (parsedDate !== null) return parsedDate;
  const parsedClock = parseClockText(value);
  if (parsedClock !== null) return parsedClock;
  return 0;
};

export const formatMessageTimeLabel = (value: string | null | undefined): string => {
  if (!value) return "";
  const parsedDate = canParseDate(value);
  if (parsedDate === null) return value;
  return new Date(parsedDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const getConversationLastActivityMs = (conversation: Conversation): number => {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  if (lastMessage?.timestamp) return getMessageTimeMs(lastMessage.timestamp);
  return getMessageTimeMs(conversation.lastMessageTime);
};

export const sortConversationsByLastActivity = (conversations: Conversation[]): Conversation[] => {
  return [...conversations].sort((a, b) => {
    const byTime = getConversationLastActivityMs(b) - getConversationLastActivityMs(a);
    if (byTime !== 0) return byTime;
    return a.participantName.localeCompare(b.participantName);
  });
};

const includesNormalized = (value: string | undefined, normalizedQuery: string): boolean => {
  if (!value) return false;
  return value.toLowerCase().includes(normalizedQuery);
};

export const filterConversationsByQuery = (
  conversations: Conversation[],
  getDisplayName: (conversation: Conversation) => string,
  query: string,
): Conversation[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return conversations;

  return conversations.filter((conversation) => {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    return (
      includesNormalized(getDisplayName(conversation), normalized) ||
      includesNormalized(conversation.lastMessage, normalized) ||
      includesNormalized(lastMessage?.content, normalized)
    );
  });
};

export type ConversationContextFilter = "all" | "intervention" | "referral";

export const conversationMatchesContextFilter = (
  conversation: Conversation,
  filter: ConversationContextFilter,
): boolean => {
  if (filter === "all") return true;
  return conversation.threadContext?.type === filter;
};

export const summarizeThreadContext = (context: MessageThreadContext | undefined): string | null => {
  if (!context) return null;
  if (context.type === "intervention") {
    const plan = context.interventionPlanName ? ` - ${context.interventionPlanName}` : "";
    return `Intervention${plan}`;
  }
  const parts = ["Referral"];
  if (context.referralId) parts.push(context.referralId);
  if (context.referralUrgency) parts.push(context.referralUrgency);
  return parts.join(" - ");
};

export const toLaunchContextSignature = (launchContext: MessagesLaunchContext | null | undefined): string => {
  if (!launchContext) return "";
  return JSON.stringify({
    recipientName: launchContext.recipientName ?? "",
    recipientRole: launchContext.recipientRole ?? "",
    draft: launchContext.draft ?? "",
    context: launchContext.context
      ? {
          type: launchContext.context.type,
          studentName: launchContext.context.studentName,
          interventionId: launchContext.context.interventionId ?? "",
          interventionPlanName: launchContext.context.interventionPlanName ?? "",
          referralId: launchContext.context.referralId ?? "",
          referralType: launchContext.context.referralType ?? "",
          referralUrgency: launchContext.context.referralUrgency ?? "",
        }
      : null,
  });
};

export const validateAttachment = (
  file: File,
  existingCount: number,
): { ok: true } | { ok: false; error: string } => {
  if (existingCount >= MAX_ATTACHMENTS_PER_MESSAGE) {
    return { ok: false, error: `You can attach up to ${MAX_ATTACHMENTS_PER_MESSAGE} files per message.` };
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { ok: false, error: `\"${file.name}\" is larger than 10 MB.` };
  }

  const hasAllowedPrefix = ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
  const hasAllowedType = ALLOWED_MIME_TYPES.includes(file.type);
  if (!hasAllowedPrefix && !hasAllowedType) {
    return { ok: false, error: `\"${file.name}\" is not a supported file type.` };
  }

  return { ok: true };
};
