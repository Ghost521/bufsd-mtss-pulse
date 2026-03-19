import { z } from "zod";

const trimmedString = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} must be ${max} characters or fewer.`);

const optionalTrimmedString = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`).optional();

const isoDatetime = z.string().datetime("Timestamp must be a valid ISO datetime.");
const isoDate = z.string().date("Date must be a valid ISO date.");
const base64Payload = trimmedString("Document payload", 8_500_000);
const mimeType = z
  .string()
  .trim()
  .min(3, "MIME type is required.")
  .max(200, "MIME type must be 200 characters or fewer.")
  .regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i, "MIME type must be valid.");

const chatMessageSchema = z.object({
  id: trimmedString("Message id", 160),
  role: z.enum(["user", "model"]),
  text: trimmedString("Message text", 20_000),
  timestamp: z.union([isoDatetime, z.date()]),
  sources: z.array(trimmedString("Message source", 500)).max(20, "Message sources must contain 20 items or fewer.").optional(),
});

const ragDocumentSchema = z.object({
  id: trimmedString("Document id", 160),
  name: trimmedString("Document name", 500),
  type: trimmedString("Document type", 120),
  uploadDate: isoDatetime,
  uploaderName: trimmedString("Uploader name", 200),
  uploaderRole: trimmedString("Uploader role", 60),
  scope: trimmedString("Document scope", 60),
  targetId: optionalTrimmedString("Target id", 160),
  status: trimmedString("Document status", 60),
  summary: optionalTrimmedString("Document summary", 4_000),
  size: optionalTrimmedString("Document size", 80),
  uri: optionalTrimmedString("Document URI", 2_000),
  base64Data: optionalTrimmedString("Document payload", 8_500_000),
  mimeType: mimeType.optional(),
  sourceUrl: z.string().trim().url("Document source URL must be valid.").max(2_000, "Document source URL must be 2000 characters or fewer.").optional(),
});

const activityLogSchema = z.object({
  date: trimmedString("Activity date", 100),
  type: trimmedString("Activity type", 120),
  note: trimmedString("Activity note", 8_000),
  source: optionalTrimmedString("Activity source", 200),
  isNew: z.boolean().optional(),
  tags: z.array(trimmedString("Activity tag", 80)).max(20, "Activity tags must contain 20 items or fewer.").optional(),
});

const interventionSchema = z.object({
  id: z.union([z.number(), trimmedString("Intervention id", 160)]),
  name: trimmedString("Intervention name", 200),
  date: trimmedString("Intervention date", 100),
  status: trimmedString("Intervention status", 120),
  progress: z.number().finite(),
  baselineScore: z.number().finite(),
  goalScore: z.number().finite(),
  dataPoints: z.array(z.unknown()).max(500, "Intervention data points must contain 500 items or fewer."),
  notes: z.array(z.unknown()).max(200, "Intervention notes must contain 200 items or fewer.").optional(),
});

const studentProfileSchema = z.object({
  id: trimmedString("Student id", 160),
  name: optionalTrimmedString("Student name", 200),
  grade: trimmedString("Student grade", 40),
  teacher: trimmedString("Teacher name", 200),
  tier: trimmedString("Tier", 40),
  attendance: z.number().finite(),
  gpa: trimmedString("GPA", 40),
  readingLevel: trimmedString("Reading level", 80),
  interventions: z.array(interventionSchema).max(100, "Interventions must contain 100 items or fewer."),
  recentActivity: z.array(activityLogSchema).max(500, "Recent activity must contain 500 items or fewer."),
  academicProgress: z.array(z.unknown()).max(500, "Academic progress must contain 500 items or fewer.").optional(),
  readingAssessments: z.array(z.unknown()).max(500, "Reading assessments must contain 500 items or fewer.").optional(),
  notes: z.array(z.unknown()).max(200, "Student notes must contain 200 items or fewer.").optional(),
  aiRecommendations: z.array(z.unknown()).max(100, "AI recommendations must contain 100 items or fewer."),
  medical: z.record(z.string(), z.unknown()),
  support: z.record(z.string(), z.unknown()),
});

const calendarEventSchema = z.object({
  id: trimmedString("Calendar event id", 160),
  title: trimmedString("Calendar event title", 200),
  description: optionalTrimmedString("Calendar event description", 4_000),
  type: trimmedString("Calendar event type", 120),
  start: isoDatetime,
  end: isoDatetime,
  allDay: z.boolean().optional(),
  timezone: optionalTrimmedString("Calendar event timezone", 80),
  location: optionalTrimmedString("Calendar event location", 200),
  organizer: trimmedString("Calendar event organizer", 200),
  attendees: z.array(z.unknown()).max(200, "Calendar attendees must contain 200 items or fewer."),
  attachments: z.array(z.unknown()).max(50, "Calendar attachments must contain 50 items or fewer.").optional(),
  recurrence: z.unknown().optional(),
  parentId: optionalTrimmedString("Calendar parent id", 160),
});

export const AI_REQUEST_LIMITS = {
  default: 256_000,
  ragChat: 1_500_000,
  document: 8_500_000,
  importBatchAnalysis: 1_000_000,
} as const;

export const ragChatRequestSchema = z.object({
  query: trimmedString("Query", 4_000),
  history: z.array(chatMessageSchema).max(30, "History must contain 30 items or fewer."),
  contextDocuments: z.array(ragDocumentSchema).max(12, "Context documents must contain 12 items or fewer."),
});

export const dashboardBriefingRequestSchema = z.object({
  data: z.record(z.string(), z.unknown()).or(z.array(z.unknown())),
  previousFeedback: z.array(trimmedString("Feedback item", 2_000)).max(25, "Previous feedback must contain 25 items or fewer."),
});

export const studentProfileSummaryRequestSchema = z.object({
  student: studentProfileSchema,
  previousFeedback: z.array(trimmedString("Feedback item", 2_000)).max(25, "Previous feedback must contain 25 items or fewer."),
});

export const notesSummaryRequestSchema = z.object({
  notes: z.array(activityLogSchema).max(500, "Notes must contain 500 items or fewer."),
});

export const refineDraftNoteRequestSchema = z.object({
  draft: trimmedString("Draft", 20_000),
  category: trimmedString("Category", 120),
});

export const suggestTagsRequestSchema = z.object({
  note: trimmedString("Note", 20_000),
});

export const actionItemPlanRequestSchema = z.object({
  studentName: trimmedString("Student name", 200),
  grade: trimmedString("Grade", 40),
  category: trimmedString("Category", 120),
  insight: trimmedString("Insight", 4_000),
});

export const structuredInterventionRequestSchema = z.object({
  studentName: trimmedString("Student name", 200),
  grade: trimmedString("Grade", 40),
  tier: trimmedString("Tier", 40),
  focusArea: trimmedString("Focus area", 200),
  additionalContext: optionalTrimmedString("Additional context", 4_000),
  duration: optionalTrimmedString("Duration", 120),
  frequency: optionalTrimmedString("Frequency", 120),
});

export const parentMessageRequestSchema = z.object({
  studentName: trimmedString("Student name", 200),
  assignmentTitle: trimmedString("Assignment title", 200),
  parentName: trimmedString("Parent name", 200),
});

export const analyzeUploadedDocumentRequestSchema = z.object({
  base64: base64Payload,
  mime: mimeType,
  name: trimmedString("Document name", 500),
});

export const fileSummaryRequestSchema = z.object({
  base64: base64Payload,
  mime: mimeType,
});

export const resourceSummaryRequestSchema = z.object({
  url: z.string().trim().url("Resource URL must be valid.").max(2_000, "Resource URL must be 2000 characters or fewer."),
  type: z.enum(["WEBSITE", "YOUTUBE"]),
});

export const extractDataFromDocumentRequestSchema = z.object({
  base64: base64Payload,
  mime: mimeType,
});

export const importBatchAnalysisRequestSchema = z.object({
  data: z.array(z.unknown()).max(1_000, "Imported data must contain 1000 rows or fewer."),
  source: trimmedString("Source", 200),
});

export const meetingTimesRequestSchema = z.object({
  attendees: z.array(trimmedString("Attendee", 200)).min(1, "At least one attendee is required.").max(50, "Attendees must contain 50 items or fewer."),
  duration: z.number().finite().min(15, "Duration must be at least 15 minutes.").max(480, "Duration must be 480 minutes or fewer."),
  date: isoDate,
  existing: z.array(calendarEventSchema).max(500, "Existing events must contain 500 items or fewer."),
});
