import { z } from "zod";
import { ApprovalStatus, AttendanceStatus, DocumentScope, EventType, Tier, UserRole } from "../../types";
import { districtBrandingRecordSchema } from "./branding";
import { settingsRecordSchema } from "./settings";

const nonEmptyTrimmedString = (label: string, max = 4_000) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const attachmentSchema = z.object({
  id: nonEmptyTrimmedString("Attachment id", 160),
  type: z.enum(["image", "file", "video"]),
  url: nonEmptyTrimmedString("Attachment url", 2_000_000),
  name: nonEmptyTrimmedString("Attachment name", 512),
  size: z.string().trim().max(64).optional(),
  mimeType: z.string().trim().max(256).optional(),
});

const calendarAttendeeSchema = z.object({
  name: nonEmptyTrimmedString("Attendee name", 160),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(AttendanceStatus),
  avatarSeed: z.string().trim().min(1).max(256).optional(),
});

const calendarRecurrenceSchema = z.object({
  pattern: z.enum(["Daily", "Weekly", "Monthly"]),
  endDate: z.string().datetime("Recurrence end date must be an ISO datetime."),
});

const messageThreadContextSchema = z.object({
  type: z.enum(["intervention", "referral"]),
  studentName: nonEmptyTrimmedString("Thread student name", 200),
  interventionId: z.string().trim().min(1).max(160).optional(),
  interventionPlanName: z.string().trim().min(1).max(280).optional(),
  referralId: z.string().trim().min(1).max(160).optional(),
  referralType: z.string().trim().min(1).max(120).optional(),
  referralUrgency: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
});

export const calendarEventRowSchema = z.object({
  id: nonEmptyTrimmedString("Event id", 160),
  title: nonEmptyTrimmedString("Event title", 280),
  description: z.string().trim().max(5_000).optional(),
  type: z.nativeEnum(EventType),
  start: z.string().datetime("Event start must be an ISO datetime."),
  end: z.string().datetime("Event end must be an ISO datetime."),
  allDay: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(120).optional(),
  location: z.string().trim().max(512).optional(),
  organizer: nonEmptyTrimmedString("Organizer", 160),
  attendees: z.array(calendarAttendeeSchema),
  attachments: z.array(attachmentSchema).optional(),
  recurrence: calendarRecurrenceSchema.optional(),
  parentId: z.string().trim().min(1).max(160).optional(),
});

const messageSchema = z.object({
  id: nonEmptyTrimmedString("Message id", 160),
  senderId: nonEmptyTrimmedString("Sender id", 160),
  senderName: nonEmptyTrimmedString("Sender name", 160),
  content: z.string().max(20_000),
  timestamp: nonEmptyTrimmedString("Timestamp", 120),
  isRead: z.boolean(),
  isMe: z.boolean(),
  attachments: z.array(attachmentSchema).optional(),
  threadContext: messageThreadContextSchema.optional(),
});

export const conversationRowSchema = z.object({
  id: nonEmptyTrimmedString("Conversation id", 160),
  participantId: nonEmptyTrimmedString("Participant id", 160),
  participantName: nonEmptyTrimmedString("Participant name", 200),
  participantRole: z.union([z.nativeEnum(UserRole), z.literal("Group")]),
  participantAvatarSeed: nonEmptyTrimmedString("Avatar seed", 256),
  lastMessage: z.string().max(20_000),
  lastMessageTime: nonEmptyTrimmedString("Last message time", 160),
  unreadCount: z.number().int().min(0),
  messages: z.array(messageSchema),
  isGroup: z.boolean().optional(),
  participants: z.array(nonEmptyTrimmedString("Participant", 200)).optional(),
  threadContext: messageThreadContextSchema.optional(),
});

const notificationCategorySchema = z.enum(["Message", "Referral", "Intervention", "Document", "System"]);
const notificationSeveritySchema = z.enum(["info", "warning", "critical"]);
const notificationSourceTypeSchema = z.enum(["messages", "referrals", "interventions", "documents", "system"]);

export const notificationRowSchema = z.object({
  id: nonEmptyTrimmedString("Notification id", 160),
  recipientUserId: nonEmptyTrimmedString("Notification recipient user id", 160),
  recipientUserName: nonEmptyTrimmedString("Notification recipient user name", 200),
  title: nonEmptyTrimmedString("Notification title", 280),
  summary: nonEmptyTrimmedString("Notification summary", 1_000),
  body: nonEmptyTrimmedString("Notification body", 10_000),
  category: notificationCategorySchema,
  severity: notificationSeveritySchema,
  sourceType: notificationSourceTypeSchema,
  sourceId: nonEmptyTrimmedString("Notification source id", 160),
  sourceFingerprint: nonEmptyTrimmedString("Notification source fingerprint", 320),
  sourceRoute: z.string().trim().min(1).max(120).optional(),
  sourceContext: z.record(z.string(), z.string().trim().max(500)).optional(),
  createdAt: z.string().datetime("Notification createdAt must be an ISO datetime."),
  seenAt: z.string().datetime("Notification seenAt must be an ISO datetime.").optional(),
  readAt: z.string().datetime("Notification readAt must be an ISO datetime.").optional(),
  dismissedAt: z.string().datetime("Notification dismissedAt must be an ISO datetime.").optional(),
  archivedAt: z.string().datetime("Notification archivedAt must be an ISO datetime.").optional(),
  deletedAt: z.string().datetime("Notification deletedAt must be an ISO datetime.").optional(),
  updatedAt: z.string().datetime("Notification updatedAt must be an ISO datetime."),
});

export const documentRowSchema = z.object({
  id: nonEmptyTrimmedString("Document id", 160),
  name: nonEmptyTrimmedString("Document name", 512),
  type: nonEmptyTrimmedString("Document type", 80),
  uploadDate: nonEmptyTrimmedString("Upload date", 160),
  uploaderName: nonEmptyTrimmedString("Uploader name", 160),
  uploaderRole: z.nativeEnum(UserRole),
  scope: z.nativeEnum(DocumentScope),
  targetId: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(ApprovalStatus),
  summary: z.string().trim().max(20_000).optional(),
  size: z.string().trim().max(80).optional(),
  uri: z.string().trim().max(5_000).optional(),
  base64Data: z.string().max(20_000_000).optional(),
  mimeType: z.string().trim().max(256).optional(),
  sourceUrl: z.string().trim().max(5_000).optional(),
});

const aiInterventionPlanSchema = z.object({
  title: nonEmptyTrimmedString("Plan title", 280),
  strategy: nonEmptyTrimmedString("Plan strategy", 2_000),
  frequency: nonEmptyTrimmedString("Plan frequency", 120),
  duration: nonEmptyTrimmedString("Plan duration", 120),
  monitoringMethod: nonEmptyTrimmedString("Monitoring method", 2_000),
  baseline: z.number().finite(),
  goal: z.number().finite(),
  lessonPlan: z.object({
    objective: nonEmptyTrimmedString("Objective", 4_000),
    materials: z.array(nonEmptyTrimmedString("Material", 500)),
    procedure: z.array(nonEmptyTrimmedString("Procedure step", 4_000)),
    assessment: nonEmptyTrimmedString("Assessment", 4_000),
    differentiation: nonEmptyTrimmedString("Differentiation", 4_000),
  }),
});

const interventionGoalStatusSchema = z.enum(["active", "met", "unmet"]);
const interventionMilestoneStatusSchema = z.enum(["pending", "met", "missed"]);
const interventionWorkflowStatusSchema = z.enum([
  "draft",
  "pending_review",
  "approved_provisional",
  "approved",
  "denied",
  "active",
  "completed_success",
  "completed_unsuccessful",
  "needs_reassessment",
]);
const interventionDecisionSchema = z.enum(["pending", "approved", "denied"]);
const interventionMeetingStatusSchema = z.enum(["draft", "confirmed", "expired", "declined"]);
const interventionOutcomeEvaluatorSchema = z.enum(["auto", "manual"]);
const interventionRecommendationSourceSchema = z.enum(["reading", "math", "composite"]);
const interventionAuditTypeSchema = z.enum([
  "created",
  "recommended",
  "approved",
  "denied",
  "cosigned",
  "meeting_proposed",
  "meeting_confirmed",
  "goal_updated",
  "milestone_updated",
  "outcome_updated",
]);
const interventionVisibilityRoleSchema = z.enum(["Teacher", "Principal", "District Admin", "Interventionist"]);

const interventionAuditEntrySchema = z.object({
  id: nonEmptyTrimmedString("Intervention audit id", 160),
  type: interventionAuditTypeSchema,
  at: z.string().datetime("Intervention audit timestamp must be an ISO datetime."),
  actorName: nonEmptyTrimmedString("Intervention audit actor name", 200),
  summary: nonEmptyTrimmedString("Intervention audit summary", 2_000),
});

const interventionMeetingProposalSchema = z.object({
  proposedStart: z.string().datetime("Meeting proposal start must be an ISO datetime."),
  proposedEnd: z.string().datetime("Meeting proposal end must be an ISO datetime."),
  timezone: nonEmptyTrimmedString("Meeting proposal timezone", 120),
  participants: z.array(nonEmptyTrimmedString("Meeting proposal participant", 200)).min(1),
  source: z.literal("availability-engine"),
  status: interventionMeetingStatusSchema,
  expiresAt: z.string().datetime("Meeting proposal expiry must be an ISO datetime."),
  reason: nonEmptyTrimmedString("Meeting proposal reason", 1_000),
});

const interventionGoalSchema = z.object({
  id: nonEmptyTrimmedString("Intervention goal id", 160),
  title: nonEmptyTrimmedString("Intervention goal title", 300),
  description: nonEmptyTrimmedString("Intervention goal description", 4_000),
  durationMonths: z.number().int().min(1).max(24),
  startDate: nonEmptyTrimmedString("Intervention goal start date", 80),
  targetDate: nonEmptyTrimmedString("Intervention goal target date", 80),
  status: interventionGoalStatusSchema,
  successCriteria: nonEmptyTrimmedString("Intervention success criteria", 2_000),
  aiSuggested: z.boolean(),
  progressTarget: z.number().int().min(0).max(100),
  currentProgress: z.number().int().min(0).max(100),
  editedAt: z.string().datetime("Intervention goal edited timestamp must be an ISO datetime."),
  editedByName: nonEmptyTrimmedString("Intervention goal editor name", 200),
});

const interventionMilestoneSchema = z.object({
  id: nonEmptyTrimmedString("Intervention milestone id", 160),
  goalId: nonEmptyTrimmedString("Intervention milestone goal id", 160),
  title: nonEmptyTrimmedString("Intervention milestone title", 300),
  dueDate: nonEmptyTrimmedString("Intervention milestone due date", 80),
  status: interventionMilestoneStatusSchema,
  evidenceNoteId: z.string().trim().max(160).optional(),
  aiSuggested: z.boolean(),
  editedAt: z.string().datetime("Intervention milestone edited timestamp must be an ISO datetime."),
});

const interventionNoteRevisionSchema = z.object({
  id: nonEmptyTrimmedString("Intervention note revision id", 160),
  contentHtml: nonEmptyTrimmedString("Intervention note revision HTML", 500_000),
  contentText: z.string().trim().max(200_000),
  editedAt: z.string().datetime("Intervention note revision edited timestamp must be an ISO datetime."),
  editedByName: nonEmptyTrimmedString("Intervention note revision editor", 200),
});

const interventionNoteSchema = z.object({
  id: nonEmptyTrimmedString("Intervention note id", 160),
  title: z.string().trim().max(300).optional(),
  contentHtml: nonEmptyTrimmedString("Intervention note HTML", 500_000),
  contentText: z.string().trim().max(200_000),
  createdAt: z.string().datetime("Intervention note created timestamp must be an ISO datetime."),
  createdByName: nonEmptyTrimmedString("Intervention note creator", 200),
  updatedAt: z.string().datetime("Intervention note updated timestamp must be an ISO datetime."),
  updatedByName: nonEmptyTrimmedString("Intervention note editor", 200),
  visibility: z.literal("staff"),
  visibilityRoles: z.array(interventionVisibilityRoleSchema).min(1),
  revisionCount: z.number().int().min(0),
  revisions: z.array(interventionNoteRevisionSchema),
});

const interventionOutcomeSchema = z.object({
  met: z.boolean().nullable(),
  evaluatedAt: z.string().datetime("Intervention outcome timestamp must be an ISO datetime.").optional(),
  evaluatorType: interventionOutcomeEvaluatorSchema.optional(),
  summaryNoteId: z.string().trim().max(160).optional(),
});

const interventionAutoRecommendationSchema = z.object({
  source: interventionRecommendationSourceSchema,
  belowSince: nonEmptyTrimmedString("Recommendation below-since date", 80),
  consecutiveWeeks: z.number().int().min(1).max(104),
  triggerThresholdId: nonEmptyTrimmedString("Recommendation threshold id", 200),
  generatedAt: z.string().datetime("Recommendation generated timestamp must be an ISO datetime."),
});

export const interventionRowSchema = z.object({
  id: nonEmptyTrimmedString("Record id", 160),
  referralId: z.string().trim().max(160).optional(),
  studentName: nonEmptyTrimmedString("Student name", 160),
  firstName: nonEmptyTrimmedString("First name", 120),
  lastName: nonEmptyTrimmedString("Last name", 120),
  grade: nonEmptyTrimmedString("Grade", 24),
  teacher: nonEmptyTrimmedString("Teacher", 160),
  tier: z.nativeEnum(Tier),
  focusArea: z.string().trim().min(1).max(160).optional(),
  planName: nonEmptyTrimmedString("Plan name", 280),
  startDate: nonEmptyTrimmedString("Start date", 160),
  durationWeeks: z.number().int().min(1).max(104),
  progress: z.number().int().min(0).max(100),
  attendance: z.number().int().min(0).max(100),
  status: z.enum(["On Track", "At Risk", "Critical"]),
  avatarSeed: nonEmptyTrimmedString("Avatar seed", 256),
  lessonPlan: aiInterventionPlanSchema.optional(),
  workflowStatus: interventionWorkflowStatusSchema.optional(),
  decision: interventionDecisionSchema.optional(),
  decisionByName: z.string().trim().max(200).optional(),
  decisionByRole: z.nativeEnum(UserRole).optional(),
  decisionAt: z.string().datetime("Decision timestamp must be an ISO datetime.").optional(),
  decisionReason: z.string().trim().max(2_000).optional(),
  requiresPrincipalCosign: z.boolean().optional(),
  principalCosignAt: z.string().datetime("Principal cosign timestamp must be an ISO datetime.").optional(),
  principalCosignByName: z.string().trim().max(200).optional(),
  principalCosignByUserId: z.string().trim().max(160).optional(),
  meetingProposal: interventionMeetingProposalSchema.optional(),
  meetingEventId: z.string().trim().max(160).optional(),
  goals: z.array(interventionGoalSchema).optional(),
  milestones: z.array(interventionMilestoneSchema).optional(),
  outcome: interventionOutcomeSchema.optional(),
  autoRecommendation: interventionAutoRecommendationSchema.optional(),
  notes: z.array(interventionNoteSchema).optional(),
  auditTrail: z.array(interventionAuditEntrySchema).optional(),
});

export const lessonPlanRowSchema = aiInterventionPlanSchema.extend({
  id: nonEmptyTrimmedString("Lesson plan id", 160),
  subject: nonEmptyTrimmedString("Subject", 120),
  grade: nonEmptyTrimmedString("Grade", 24),
  createdDate: nonEmptyTrimmedString("Created date", 160),
  updatedAt: nonEmptyTrimmedString("Updated date", 160).optional(),
  author: nonEmptyTrimmedString("Author", 160),
  ownerId: nonEmptyTrimmedString("Owner id", 160),
  isShared: z.boolean(),
  studentGroup: z.array(nonEmptyTrimmedString("Student name", 160)).optional(),
});

export const importRowSchema = z.object({
  id: nonEmptyTrimmedString("Import id", 160),
}).passthrough();

export const staffRosterRowSchema = z.object({
  id: nonEmptyTrimmedString("Staff id", 160),
  name: nonEmptyTrimmedString("Staff name", 200),
  role: z.enum(["Teacher", "Consultant", "Specialist"]),
  isInterventionist: z.boolean().optional(),
  interventionFocus: z.array(z.enum(["Math", "Reading"])).optional(),
  grade: z.string().trim().max(80).optional(),
  studentCount: z.number().int().min(0).max(5_000),
  attendanceRate: z.number().min(0).max(100),
  performanceMetric: nonEmptyTrimmedString("Performance metric", 500),
  mtssFidelityScore: z.number().int().min(0).max(100),
  activeInterventions: z.number().int().min(0).max(5_000),
  flaggedStudents: z.number().int().min(0).max(5_000),
  avatarSeed: nonEmptyTrimmedString("Avatar seed", 256),
  customAvatar: z.string().max(8_000_000).optional(),
});

export const gradebookAssignmentRowSchema = z.object({
  id: nonEmptyTrimmedString("Assignment id", 160),
  title: nonEmptyTrimmedString("Assignment title", 280),
  date: nonEmptyTrimmedString("Assignment date", 80),
  type: z.enum(["Homework", "Quiz", "Test", "Project"]),
  maxPoints: z.number().int().min(0).max(10_000),
  subject: nonEmptyTrimmedString("Assignment subject", 120),
  description: z.string().trim().max(4_000).optional(),
});

const gradebookScoreSchema = z.union([z.number().min(0).max(100), z.enum(["M", "E", "L"]), z.null()]);

export const gradebookGradeRowSchema = z.object({
  id: nonEmptyTrimmedString("Grade row id", 320),
  studentId: nonEmptyTrimmedString("Student id", 160),
  assignmentId: nonEmptyTrimmedString("Assignment id", 160),
  score: gradebookScoreSchema,
});

const profileInterventionDataPointSchema = z.object({
  date: nonEmptyTrimmedString("Intervention data point date", 80),
  score: z.number().finite(),
  notes: z.string().trim().max(2_000).optional(),
});

const profileInterventionSchema = z.object({
  id: z.number().int().min(0),
  name: nonEmptyTrimmedString("Intervention name", 280),
  date: nonEmptyTrimmedString("Intervention date", 80),
  status: nonEmptyTrimmedString("Intervention status", 80),
  progress: z.number().int().min(0).max(100),
  baselineScore: z.number().finite(),
  goalScore: z.number().finite(),
  dataPoints: z.array(profileInterventionDataPointSchema),
});

const profileActivitySchema = z.object({
  date: nonEmptyTrimmedString("Activity date", 80),
  type: nonEmptyTrimmedString("Activity type", 120),
  note: nonEmptyTrimmedString("Activity note", 4_000),
  source: z.string().trim().max(120).optional(),
  isNew: z.boolean().optional(),
  tags: z.array(nonEmptyTrimmedString("Activity tag", 120)).optional(),
});

const studentNoteRevisionSchema = z.object({
  id: nonEmptyTrimmedString("Student note revision id", 160),
  contentHtml: nonEmptyTrimmedString("Student note revision HTML", 500_000),
  contentText: z.string().trim().max(200_000),
  editedAt: z.string().datetime("Student note revision edited timestamp must be an ISO datetime."),
  editedByUserId: z.string().trim().max(160).optional(),
  editedByName: nonEmptyTrimmedString("Student note revision editor name", 200),
});

const studentNoteSchema = z.object({
  id: nonEmptyTrimmedString("Student note id", 160),
  title: z.string().trim().max(300).optional(),
  contentHtml: nonEmptyTrimmedString("Student note HTML", 500_000),
  contentText: z.string().trim().max(200_000),
  createdAt: z.string().datetime("Student note created timestamp must be an ISO datetime."),
  createdByUserId: z.string().trim().max(160).optional(),
  createdByName: nonEmptyTrimmedString("Student note creator name", 200),
  updatedAt: z.string().datetime("Student note updated timestamp must be an ISO datetime."),
  updatedByUserId: z.string().trim().max(160).optional(),
  updatedByName: nonEmptyTrimmedString("Student note editor name", 200),
  visibility: z.literal("staff"),
  isDeleted: z.boolean().optional(),
  deletedAt: z.string().datetime("Student note deleted timestamp must be an ISO datetime.").optional(),
  deletedByUserId: z.string().trim().max(160).optional(),
  deletedByName: z.string().trim().max(200).optional(),
  revisionCount: z.number().int().min(0),
  revisions: z.array(studentNoteRevisionSchema),
});

const profileRecommendationSchema = z.object({
  id: nonEmptyTrimmedString("Recommendation id", 160),
  name: nonEmptyTrimmedString("Recommendation name", 200),
  reason: nonEmptyTrimmedString("Recommendation reason", 4_000),
  action: nonEmptyTrimmedString("Recommendation action", 4_000),
  confidenceLevel: nonEmptyTrimmedString("Confidence level", 80),
  confidenceScore: z.number().int().min(0).max(100),
});

const profileMedicalSchema = z.object({
  allergies: z.array(nonEmptyTrimmedString("Allergy", 160)),
  medications: z.array(nonEmptyTrimmedString("Medication", 160)),
  visionScreening: z.object({
    status: z.enum(["Pass", "Fail", "Corrected"]),
    date: nonEmptyTrimmedString("Vision screening date", 80),
    notes: z.string().trim().max(2_000).optional(),
  }),
  hearingScreening: z.object({
    status: z.enum(["Pass", "Fail"]),
    date: nonEmptyTrimmedString("Hearing screening date", 80),
  }),
  conditions: z.array(nonEmptyTrimmedString("Condition", 200)),
});

const profileSupportSchema = z.object({
  planType: z.enum(["IEP", "504 Plan", "None"]),
  primaryDisability: z.string().trim().max(320).optional(),
  nextReviewDate: z.string().trim().max(120).optional(),
  accommodations: z.array(nonEmptyTrimmedString("Accommodation", 500)),
  behavioralStrategies: z.array(nonEmptyTrimmedString("Behavioral strategy", 500)),
});

export const studentProfileRowSchema = z.object({
  id: nonEmptyTrimmedString("Student id", 160),
  name: nonEmptyTrimmedString("Student name", 200),
  grade: nonEmptyTrimmedString("Grade", 80),
  teacher: nonEmptyTrimmedString("Teacher", 200),
  tier: z.nativeEnum(Tier),
  attendance: z.number().int().min(0).max(100),
  gpa: nonEmptyTrimmedString("GPA", 16),
  readingLevel: nonEmptyTrimmedString("Reading level", 24),
  interventions: z.array(profileInterventionSchema),
  recentActivity: z.array(profileActivitySchema),
  notes: z.array(studentNoteSchema).default([]),
  aiRecommendations: z.array(profileRecommendationSchema),
  medical: profileMedicalSchema,
  support: profileSupportSchema,
  avatarUrl: z.string().max(8_000_000).optional(),
  updatedAt: z.string().datetime("Updated timestamp must be an ISO datetime."),
});

const referralAttachmentSchema = z.object({
  name: nonEmptyTrimmedString("Attachment name", 512),
  size: z.number().int().min(0).optional(),
  type: z.string().trim().max(160).optional(),
});

export const referralRowSchema = z.object({
  id: nonEmptyTrimmedString("Referral id", 160),
  studentId: nonEmptyTrimmedString("Student id", 160),
  studentName: nonEmptyTrimmedString("Student name", 200),
  grade: z.string().trim().max(80).optional(),
  type: z.enum(["Behavior", "Academic", "Attendance", "Social-Emotional", "Health"]),
  urgency: z.enum(["Low", "Medium", "High", "Critical"]),
  notes: nonEmptyTrimmedString("Referral notes", 4_000),
  attachments: z.array(referralAttachmentSchema).optional(),
  status: z.literal("Pending Review"),
  routedTo: nonEmptyTrimmedString("Routed team", 160),
  createdAt: z.string().datetime("Created timestamp must be an ISO datetime."),
});

export const dataDomainRowSchemaMap = {
  branding: districtBrandingRecordSchema,
  calendar: calendarEventRowSchema,
  notifications: notificationRowSchema,
  messages: conversationRowSchema,
  documents: documentRowSchema,
  interventions: interventionRowSchema,
  "lesson-plans": lessonPlanRowSchema,
  imports: importRowSchema,
  settings: settingsRecordSchema,
  staff: staffRosterRowSchema,
  "gradebook-assignments": gradebookAssignmentRowSchema,
  "gradebook-grades": gradebookGradeRowSchema,
  "student-profiles": studentProfileRowSchema,
  referrals: referralRowSchema,
} as const;

export const dataDomainCollectionSchemaMap = {
  branding: z.array(districtBrandingRecordSchema),
  calendar: z.array(calendarEventRowSchema),
  notifications: z.array(notificationRowSchema),
  messages: z.array(conversationRowSchema),
  documents: z.array(documentRowSchema),
  interventions: z.array(interventionRowSchema),
  "lesson-plans": z.array(lessonPlanRowSchema),
  imports: z.array(importRowSchema),
  settings: z.array(settingsRecordSchema),
  staff: z.array(staffRosterRowSchema),
  "gradebook-assignments": z.array(gradebookAssignmentRowSchema),
  "gradebook-grades": z.array(gradebookGradeRowSchema),
  "student-profiles": z.array(studentProfileRowSchema),
  referrals: z.array(referralRowSchema),
} as const;
