import { AttendanceStatus, EventType, Tier, UserRole, type CalendarEvent } from "../types";
import { evaluateReadingRisk } from "./reading-benchmarks";

export type InterventionWorkflowStatus =
  | "draft"
  | "pending_review"
  | "approved_provisional"
  | "approved"
  | "denied"
  | "active"
  | "completed_success"
  | "completed_unsuccessful"
  | "needs_reassessment";

export type InterventionDecision = "pending" | "approved" | "denied";
export type MeetingProposalStatus = "draft" | "confirmed" | "expired" | "declined";
export type InterventionGoalStatus = "active" | "met" | "unmet";
export type InterventionMilestoneStatus = "pending" | "met" | "missed";
export type InterventionOutcomeEvaluator = "auto" | "manual";
export type InterventionRecommendationSource = "reading" | "math" | "composite";
export type InterventionAuditType =
  | "created"
  | "recommended"
  | "approved"
  | "denied"
  | "cosigned"
  | "meeting_proposed"
  | "meeting_confirmed"
  | "goal_updated"
  | "milestone_updated"
  | "outcome_updated";

export type InterventionVisibilityRole = "Teacher" | "Principal" | "District Admin" | "Interventionist";

export type InterventionAuditEntry = {
  id: string;
  type: InterventionAuditType;
  at: string;
  actorName: string;
  summary: string;
};

export type InterventionMeetingProposal = {
  proposedStart: string;
  proposedEnd: string;
  timezone: string;
  participants: string[];
  source: "availability-engine";
  status: MeetingProposalStatus;
  expiresAt: string;
  reason: string;
};

export type InterventionGoal = {
  id: string;
  title: string;
  description: string;
  durationMonths: number;
  startDate: string;
  targetDate: string;
  status: InterventionGoalStatus;
  successCriteria: string;
  aiSuggested: boolean;
  progressTarget: number;
  currentProgress: number;
  editedAt: string;
  editedByName: string;
};

export type InterventionMilestone = {
  id: string;
  goalId: string;
  title: string;
  dueDate: string;
  status: InterventionMilestoneStatus;
  evidenceNoteId?: string;
  aiSuggested: boolean;
  editedAt: string;
};

export type InterventionNoteRevision = {
  id: string;
  contentHtml: string;
  contentText: string;
  editedAt: string;
  editedByName: string;
};

export type InterventionNote = {
  id: string;
  title?: string;
  contentHtml: string;
  contentText: string;
  createdAt: string;
  createdByName: string;
  updatedAt: string;
  updatedByName: string;
  visibility: "staff";
  visibilityRoles: InterventionVisibilityRole[];
  revisionCount: number;
  revisions: InterventionNoteRevision[];
};

export type InterventionOutcome = {
  met: boolean | null;
  evaluatedAt?: string;
  evaluatorType?: InterventionOutcomeEvaluator;
  summaryNoteId?: string;
};

export type InterventionAutoRecommendation = {
  source: InterventionRecommendationSource;
  belowSince: string;
  consecutiveWeeks: number;
  triggerThresholdId: string;
  generatedAt: string;
};

export type InterventionWorkflowFields = {
  workflowStatus: InterventionWorkflowStatus;
  decision: InterventionDecision;
  decisionByName?: string;
  decisionByRole?: UserRole;
  decisionAt?: string;
  decisionReason?: string;
  requiresPrincipalCosign: boolean;
  principalCosignAt?: string;
  principalCosignByName?: string;
  principalCosignByUserId?: string;
  meetingProposal?: InterventionMeetingProposal;
  meetingEventId?: string;
  goals: InterventionGoal[];
  milestones: InterventionMilestone[];
  outcome: InterventionOutcome;
  autoRecommendation?: InterventionAutoRecommendation;
  notes: InterventionNote[];
  auditTrail: InterventionAuditEntry[];
};

export type InterventionLegacyFields = {
  id: string;
  studentName: string;
  firstName: string;
  lastName: string;
  grade: string;
  teacher: string;
  tier: Tier;
  focusArea?: string;
  planName: string;
  startDate: string;
  durationWeeks: number;
  progress: number;
  attendance: number;
  status: "On Track" | "At Risk" | "Critical";
  avatarSeed: string;
  lessonPlan?: unknown;
};

export type InterventionWorkflowRecord = InterventionLegacyFields & Partial<InterventionWorkflowFields>;

export type StudentRiskInput = {
  id: string;
  name: string;
  grade: string;
  teacherName?: string;
  readingLevel?: string;
  gpa?: string;
  tier?: Tier;
  avatarSeed?: string;
};

export type MathBenchmarkThreshold = {
  minimumGpa: number;
};

export const DEFAULT_INTERVENTION_NOTE_ROLES: InterventionVisibilityRole[] = [
  "Teacher",
  "Principal",
  "District Admin",
  "Interventionist",
];

export const DEFAULT_MATH_BENCHMARKS: Record<string, MathBenchmarkThreshold> = {
  K: { minimumGpa: 2.2 },
  "1": { minimumGpa: 2.2 },
  "2": { minimumGpa: 2.3 },
  "3": { minimumGpa: 2.4 },
  "4": { minimumGpa: 2.5 },
  "5": { minimumGpa: 2.5 },
  "6": { minimumGpa: 2.6 },
  "7": { minimumGpa: 2.6 },
  "8": { minimumGpa: 2.7 },
};

const SCHOOL_DAY_START_HOUR = 9;
const SCHOOL_DAY_END_HOUR = 15;
const SLOT_MINUTES = 45;

const toIso = (value: Date): string => value.toISOString();
const isoDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const safeDateFromIso = (value: string | undefined, fallback = new Date()): Date => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const toStartOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const addDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (value: Date, months: number): Date => {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
};

const intersects = (leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date): boolean =>
  leftStart < rightEnd && rightStart < leftEnd;

const normalizeName = (value: string): string => value.trim().toLowerCase();

const makeId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const isWeekend = (value: Date): boolean => value.getDay() === 0 || value.getDay() === 6;

const hasConflict = (params: {
  events: CalendarEvent[];
  participants: string[];
  start: Date;
  end: Date;
}): boolean => {
  const participantSet = new Set(params.participants.map(normalizeName));
  for (const event of params.events) {
    const eventParticipants = new Set<string>([
      normalizeName(event.organizer),
      ...event.attendees.map((attendee) => normalizeName(attendee.name)),
    ]);
    const hasRelevantParticipant = [...eventParticipants].some((name) => participantSet.has(name));
    if (!hasRelevantParticipant) continue;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) continue;

    if (intersects(params.start, params.end, eventStart, eventEnd)) {
      return true;
    }
  }
  return false;
};

const toPercent = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const ensurePositiveInt = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : fallback;
};

const parseGradeKey = (grade: string): string | null => {
  const normalized = grade.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("k")) return "K";
  const match = normalized.match(/\b([1-8])\b/);
  return match ? match[1] : null;
};

const parseGpa = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const createInterventionGoal = (params: {
  title: string;
  description: string;
  startDate: string;
  progress: number;
  actorName: string;
  durationMonths?: number;
  aiSuggested?: boolean;
  successCriteria?: string;
}): InterventionGoal => {
  const timestamp = toIso(new Date());
  const durationMonths = ensurePositiveInt(params.durationMonths, 6);
  const start = safeDateFromIso(params.startDate);
  const target = addMonths(start, durationMonths);
  return {
    id: makeId("goal"),
    title: params.title,
    description: params.description,
    durationMonths,
    startDate: isoDateOnly(start),
    targetDate: isoDateOnly(target),
    status: "active",
    successCriteria: params.successCriteria ?? "Meet or exceed 100% intervention progress by target date.",
    aiSuggested: params.aiSuggested ?? true,
    progressTarget: 100,
    currentProgress: toPercent(params.progress, 0),
    editedAt: timestamp,
    editedByName: params.actorName,
  };
};

export const createWeeklyMilestones = (goal: InterventionGoal): InterventionMilestone[] => {
  const start = safeDateFromIso(goal.startDate);
  const target = safeDateFromIso(goal.targetDate, addMonths(start, goal.durationMonths));
  const totalDays = Math.max(7, Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const timestamp = toIso(new Date());

  return Array.from({ length: totalWeeks }, (_, index) => {
    const weekNumber = index + 1;
    const dueDate = addDays(start, weekNumber * 7);
    const boundedDueDate = dueDate > target ? target : dueDate;
    return {
      id: makeId("milestone"),
      goalId: goal.id,
      title: `Week ${weekNumber}: Progress checkpoint`,
      dueDate: isoDateOnly(boundedDueDate),
      status: "pending",
      aiSuggested: true,
      editedAt: timestamp,
    };
  });
};

export const createInterventionAuditEntry = (
  type: InterventionAuditType,
  actorName: string,
  summary: string,
): InterventionAuditEntry => ({
  id: makeId("audit"),
  type,
  at: toIso(new Date()),
  actorName,
  summary,
});

export const createInterventionNote = (
  title: string,
  content: string,
  actorName: string,
): InterventionNote => {
  const timestamp = toIso(new Date());
  const contentText = content.trim();
  const contentHtml = `<p>${contentText.replace(/[<>&]/g, (char) => {
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    return "&amp;";
  })}</p>`;
  return {
    id: makeId("intervention-note"),
    title: title.trim() || undefined,
    contentHtml,
    contentText,
    createdAt: timestamp,
    createdByName: actorName,
    updatedAt: timestamp,
    updatedByName: actorName,
    visibility: "staff",
    visibilityRoles: DEFAULT_INTERVENTION_NOTE_ROLES,
    revisionCount: 1,
    revisions: [
      {
        id: makeId("intervention-note-revision"),
        contentHtml,
        contentText,
        editedAt: timestamp,
        editedByName: actorName,
      },
    ],
  };
};

export const buildMeetingProposalFromAvailability = (params: {
  participants: string[];
  events: CalendarEvent[];
  timezone?: string;
  startsFrom?: Date;
}): InterventionMeetingProposal => {
  const timezone = params.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const startFrom = params.startsFrom ? toStartOfDay(params.startsFrom) : toStartOfDay(addDays(new Date(), 1));
  const candidateHours = [SCHOOL_DAY_START_HOUR, SCHOOL_DAY_START_HOUR + 1, 11, 13, 14];
  let resolvedStart: Date | null = null;
  let resolvedEnd: Date | null = null;

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const day = addDays(startFrom, dayOffset);
    if (isWeekend(day)) continue;

    for (const hour of candidateHours) {
      const candidateStart = new Date(day);
      candidateStart.setHours(hour, 0, 0, 0);
      const candidateEnd = new Date(candidateStart);
      candidateEnd.setMinutes(candidateEnd.getMinutes() + SLOT_MINUTES);

      if (candidateStart.getHours() > SCHOOL_DAY_END_HOUR) continue;
      if (hasConflict({ events: params.events, participants: params.participants, start: candidateStart, end: candidateEnd })) {
        continue;
      }

      resolvedStart = candidateStart;
      resolvedEnd = candidateEnd;
      break;
    }

    if (resolvedStart && resolvedEnd) break;
  }

  const fallbackStart = resolvedStart ?? (() => {
    const next = addDays(startFrom, 1);
    next.setHours(10, 0, 0, 0);
    return next;
  })();
  const fallbackEnd = resolvedEnd ?? (() => {
    const next = new Date(fallbackStart);
    next.setMinutes(next.getMinutes() + SLOT_MINUTES);
    return next;
  })();

  const expiresAt = addDays(new Date(), 3);
  return {
    proposedStart: toIso(fallbackStart),
    proposedEnd: toIso(fallbackEnd),
    timezone,
    participants: params.participants,
    source: "availability-engine",
    status: "draft",
    expiresAt: toIso(expiresAt),
    reason: "Best available slot based on calendar conflicts and school hours.",
  };
};

export const normalizeInterventionRecord = (
  record: InterventionWorkflowRecord,
  actorName = "System",
): InterventionWorkflowRecord & InterventionWorkflowFields => {
  const startDate = record.startDate || isoDateOnly(new Date());
  const durationWeeks = ensurePositiveInt(record.durationWeeks, 24);
  const progress = toPercent(record.progress, 0);
  const createdGoal =
    record.goals && record.goals.length > 0
      ? record.goals
      : [
          createInterventionGoal({
            title: `${record.focusArea || "Intervention"} growth goal`,
            description: `Support ${record.studentName} in ${record.focusArea || "priority skill development"}.`,
            startDate,
            progress,
            actorName,
            durationMonths: 6,
            aiSuggested: true,
          }),
        ];
  const milestones = record.milestones && record.milestones.length > 0 ? record.milestones : createWeeklyMilestones(createdGoal[0]);

  return {
    ...record,
    startDate,
    durationWeeks,
    progress,
    attendance: toPercent(record.attendance, 100),
    workflowStatus: record.workflowStatus ?? (progress >= 100 ? "completed_success" : "active"),
    decision: record.decision ?? "pending",
    requiresPrincipalCosign: record.requiresPrincipalCosign ?? false,
    goals: createdGoal,
    milestones,
    notes: record.notes ?? [],
    outcome: record.outcome ?? { met: null },
    auditTrail: record.auditTrail ?? [],
  };
};

export const applyGoalOutcomeAutomation = (
  record: InterventionWorkflowRecord & InterventionWorkflowFields,
  actorName = "System",
  now = new Date(),
): InterventionWorkflowRecord & InterventionWorkflowFields => {
  const timestamp = toIso(now);
  let goalChanged = false;
  const goalStatuses = record.goals.map((goal) => {
    if (goal.status !== "active") return goal;
    const targetDate = safeDateFromIso(goal.targetDate);
    const met = goal.currentProgress >= goal.progressTarget;
    if (targetDate <= now && !met) {
      goalChanged = true;
      return {
        ...goal,
        status: "unmet" as const,
        editedAt: timestamp,
        editedByName: actorName,
      };
    }
    if (targetDate <= now && met) {
      goalChanged = true;
      return {
        ...goal,
        status: "met" as const,
        editedAt: timestamp,
        editedByName: actorName,
      };
    }
    return goal;
  });

  const hasUnmetGoal = goalStatuses.some((goal) => goal.status === "unmet");
  const hasMetGoal = goalStatuses.length > 0 && goalStatuses.every((goal) => goal.status === "met");
  if (!hasUnmetGoal && !hasMetGoal) {
    if (!goalChanged) return record;
    return { ...record, goals: goalStatuses };
  }

  if (hasMetGoal) {
    if (record.workflowStatus === "completed_success" && record.outcome.met === true) {
      return { ...record, goals: goalStatuses };
    }
    return {
      ...record,
      goals: goalStatuses,
      workflowStatus: "completed_success",
      outcome: {
        met: true,
        evaluatedAt: timestamp,
        evaluatorType: "auto",
        summaryNoteId: record.outcome.summaryNoteId,
      },
      auditTrail: [
        ...record.auditTrail,
        createInterventionAuditEntry("outcome_updated", actorName, "Intervention marked successful after goals were met."),
      ],
    };
  }

  const existingUnmetNote = record.notes.find((note) =>
    note.title?.toLowerCase().includes("unmet intervention outcome"),
  );
  const unmetNote =
    existingUnmetNote ??
    createInterventionNote(
      "Unmet intervention outcome",
      "Goal target date passed without meeting success criteria. Intervention moved to reassessment queue.",
      actorName,
    );

  return {
    ...record,
    goals: goalStatuses,
    workflowStatus: "needs_reassessment",
    decision: "pending",
    outcome: {
      met: false,
      evaluatedAt: timestamp,
      evaluatorType: "auto",
      summaryNoteId: unmetNote.id,
    },
    notes: existingUnmetNote ? record.notes : [...record.notes, unmetNote],
    auditTrail: [
      ...record.auditTrail,
      createInterventionAuditEntry(
        "outcome_updated",
        actorName,
        "Goal was not met by target date. Note added and intervention returned to review.",
      ),
    ],
  };
};

const resolveRecommendationSource = (readingBelow: boolean, mathBelow: boolean): InterventionRecommendationSource => {
  if (readingBelow && mathBelow) return "composite";
  if (mathBelow) return "math";
  return "reading";
};

const recommendationPlanName = (source: InterventionRecommendationSource): string => {
  if (source === "composite") return "Composite Benchmark Intervention";
  if (source === "math") return "Math Benchmark Intervention";
  return "Reading Benchmark Intervention";
};

const recommendationFocusArea = (source: InterventionRecommendationSource): string => {
  if (source === "composite") return "Reading + Math";
  if (source === "math") return "Math Fluency";
  return "Reading Comprehension";
};

export const buildAutoRecommendedInterventions = (params: {
  students: StudentRiskInput[];
  existingInterventions: Array<InterventionWorkflowRecord & InterventionWorkflowFields>;
  calendarEvents: CalendarEvent[];
  mathBenchmarks?: Record<string, MathBenchmarkThreshold>;
  durationWeeks?: number;
  actorName?: string;
}): Array<InterventionWorkflowRecord & InterventionWorkflowFields> => {
  const actorName = params.actorName ?? "MTSS Monitor";
  const durationWeeks = ensurePositiveInt(params.durationWeeks, 6);
  const mathBenchmarks = params.mathBenchmarks ?? DEFAULT_MATH_BENCHMARKS;
  const now = new Date();
  const belowSince = isoDateOnly(addDays(now, -(durationWeeks * 7)));
  const today = isoDateOnly(now);
  const next: Array<InterventionWorkflowRecord & InterventionWorkflowFields> = [];

  for (const student of params.students) {
    const existing = params.existingInterventions.some((item) => {
      if (normalizeName(item.studentName) !== normalizeName(student.name)) return false;
      return (
        item.workflowStatus !== "denied" &&
        item.workflowStatus !== "completed_success" &&
        item.workflowStatus !== "completed_unsuccessful"
      );
    });
    if (existing) continue;

    const readingRisk = evaluateReadingRisk({
      grade: student.grade,
      readingLevel: student.readingLevel ?? "",
      role: UserRole.PRINCIPAL,
    });
    const readingBelow = readingRisk.tone === "warn" || readingRisk.tone === "risk";
    const gradeKey = parseGradeKey(student.grade);
    const gpaValue = parseGpa(student.gpa);
    const mathThreshold = gradeKey ? mathBenchmarks[gradeKey] : undefined;
    const mathBelow = Boolean(
      mathThreshold &&
      gpaValue !== null &&
      Number.isFinite(gpaValue) &&
      gpaValue < mathThreshold.minimumGpa,
    );

    if (!readingBelow && !mathBelow) continue;
    const source = resolveRecommendationSource(readingBelow, mathBelow);
    const participants = [
      student.teacherName || "Classroom Teacher",
      "Rosa Cortese",
      "Intervention Team",
    ];
    const meetingProposal = buildMeetingProposalFromAvailability({
      participants,
      events: params.calendarEvents,
    });
    const progress = 0;
    const goal = createInterventionGoal({
      title: `${recommendationFocusArea(source)} growth goal`,
      description: `Targeted support plan for ${student.name}.`,
      startDate: today,
      progress,
      actorName,
      durationMonths: 6,
      aiSuggested: true,
      successCriteria: "Reach benchmark expectations within 6 months.",
    });

    next.push(
      normalizeInterventionRecord(
        {
          id: `auto-${student.id}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          studentName: student.name,
          firstName: student.name.split(" ")[0] || student.name,
          lastName: student.name.split(" ").slice(1).join(" ") || "Student",
          grade: student.grade,
          teacher: student.teacherName || "Classroom Teacher",
          tier: student.tier || Tier.TIER_2,
          focusArea: recommendationFocusArea(source),
          planName: recommendationPlanName(source),
          startDate: today,
          durationWeeks: 24,
          progress,
          attendance: 100,
          status: source === "composite" ? "Critical" : "At Risk",
          avatarSeed: student.avatarSeed || student.name.replace(/\s+/g, ""),
          workflowStatus: "pending_review",
          decision: "pending",
          requiresPrincipalCosign: false,
          meetingProposal,
          goals: [goal],
          milestones: createWeeklyMilestones(goal),
          outcome: { met: null },
          autoRecommendation: {
            source,
            belowSince,
            consecutiveWeeks: durationWeeks,
            triggerThresholdId: source === "math" ? "math-gpa-threshold" : "reading-level-threshold",
            generatedAt: toIso(now),
          },
          notes: [],
          auditTrail: [
            createInterventionAuditEntry(
              "recommended",
              actorName,
              `Auto-recommended due to ${source === "composite" ? "reading and math" : source} benchmark risk.`,
            ),
          ],
        },
        actorName,
      ),
    );
  }

  return next;
};

export const buildCalendarMeetingEventFromProposal = (params: {
  interventionId: string;
  studentName: string;
  planName: string;
  proposal: InterventionMeetingProposal;
  organizerName: string;
}): CalendarEvent => ({
  id: makeId("evt-intervention"),
  title: `Intervention Review: ${params.studentName}`,
  description: `Follow-up for ${params.planName}.`,
  type: EventType.MTSS,
  start: params.proposal.proposedStart,
  end: params.proposal.proposedEnd,
  timezone: params.proposal.timezone,
  location: "MTSS Conference Room",
  organizer: params.organizerName,
  attendees: params.proposal.participants.map((name) => ({
    name,
    role: normalizeName(name) === normalizeName(params.organizerName) ? UserRole.PRINCIPAL : UserRole.TEACHER,
    status:
      normalizeName(name) === normalizeName(params.organizerName)
        ? AttendanceStatus.ORGANIZER
        : AttendanceStatus.PENDING,
  })),
});
