import { describe, expect, it } from "vitest";
import { EventType, Tier, type CalendarEvent } from "../src/types";
import {
  applyGoalOutcomeAutomation,
  buildAutoRecommendedInterventions,
  buildMeetingProposalFromAvailability,
  createInterventionGoal,
  createWeeklyMilestones,
  normalizeInterventionRecord,
} from "../src/lib/intervention-workflow";

const makeEvent = (input: Partial<CalendarEvent> & Pick<CalendarEvent, "id" | "start" | "end">): CalendarEvent => ({
  id: input.id,
  title: input.title ?? "Event",
  description: input.description,
  type: input.type ?? EventType.MTSS,
  start: input.start,
  end: input.end,
  timezone: input.timezone ?? "America/New_York",
  location: input.location ?? "Room 1",
  organizer: input.organizer ?? "Mr. Davis",
  attendees: input.attendees ?? [],
  attachments: input.attachments,
  recurrence: input.recurrence,
  parentId: input.parentId,
});

describe("intervention workflow helpers", () => {
  it("normalizes a legacy row and creates default goal/milestones", () => {
    const normalized = normalizeInterventionRecord({
      id: "i-1",
      studentName: "Jordan Lee",
      firstName: "Jordan",
      lastName: "Lee",
      grade: "4",
      teacher: "Mr. Davis",
      tier: Tier.TIER_2,
      focusArea: "Reading",
      planName: "Reading Growth Plan",
      startDate: "2026-01-01",
      durationWeeks: 6,
      progress: 18,
      attendance: 96,
      status: "At Risk",
      avatarSeed: "JordanLee",
    });

    expect(normalized.workflowStatus).toBe("active");
    expect(normalized.decision).toBe("pending");
    expect(normalized.goals.length).toBe(1);
    expect(normalized.milestones.length).toBeGreaterThan(1);
    expect(normalized.notes).toEqual([]);
  });

  it("picks a conflict-free meeting proposal slot", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const blockedStart = new Date(tomorrow);
    const blockedEnd = new Date(tomorrow);
    blockedEnd.setMinutes(blockedEnd.getMinutes() + 45);

    const events = [
      makeEvent({
        id: "evt-blocked",
        organizer: "Mr. Davis",
        start: blockedStart.toISOString(),
        end: blockedEnd.toISOString(),
      }),
    ];

    const proposal = buildMeetingProposalFromAvailability({
      participants: ["Mr. Davis", "Rosa Cortese"],
      events,
      startsFrom: tomorrow,
    });

    expect(new Date(proposal.proposedStart).getTime()).toBeGreaterThanOrEqual(blockedEnd.getTime());
    expect(proposal.status).toBe("draft");
  });

  it("creates auto recommendations for benchmark risk students", () => {
    const rows = buildAutoRecommendedInterventions({
      students: [
        {
          id: "stu-1",
          name: "Avery Stone",
          grade: "4",
          teacherName: "Mr. Davis",
          readingLevel: "M",
          gpa: "2.0",
          tier: Tier.TIER_2,
        },
      ],
      existingInterventions: [],
      calendarEvents: [],
      durationWeeks: 6,
    });

    expect(rows.length).toBe(1);
    expect(rows[0].workflowStatus).toBe("pending_review");
    expect(rows[0].autoRecommendation?.consecutiveWeeks).toBe(6);
    expect(rows[0].meetingProposal?.status).toBe("draft");
  });

  it("marks overdue unmet goals for reassessment and adds note", () => {
    const goal = createInterventionGoal({
      title: "Reading Goal",
      description: "Raise comprehension benchmark",
      startDate: "2025-01-01",
      progress: 25,
      actorName: "System",
      durationMonths: 1,
    });
    goal.targetDate = "2025-02-01";
    goal.currentProgress = 25;

    const record = normalizeInterventionRecord({
      id: "i-2",
      studentName: "Jamie Green",
      firstName: "Jamie",
      lastName: "Green",
      grade: "3",
      teacher: "Mrs. Johnson",
      tier: Tier.TIER_2,
      focusArea: "Reading",
      planName: "Reading Monitoring",
      startDate: "2025-01-01",
      durationWeeks: 24,
      progress: 25,
      attendance: 97,
      status: "At Risk",
      avatarSeed: "JamieGreen",
      goals: [goal],
      milestones: createWeeklyMilestones(goal),
    });

    const updated = applyGoalOutcomeAutomation(record, "Automation", new Date("2026-02-01T12:00:00.000Z"));

    expect(updated.workflowStatus).toBe("needs_reassessment");
    expect(updated.outcome.met).toBe(false);
    expect(updated.notes.length).toBeGreaterThan(0);
  });
});
