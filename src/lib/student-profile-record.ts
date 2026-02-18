import { Tier, type StudentDetails, type StudentRosterItem } from "../types";

type StudentRosterLike = Pick<
  StudentRosterItem,
  "id" | "name" | "grade" | "tier" | "gpa" | "attendance" | "readingLevel" | "alerts"
> & {
  teacher?: string;
};

export type StudentProfileRecord = Omit<StudentDetails, "name"> & {
  id: string;
  name: string;
  avatarUrl?: string;
  updatedAt: string;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const percentFromSeed = (seed: number, min: number, max: number): number => {
  const bounded = seed % 1000;
  const ratio = bounded / 1000;
  return Math.round(min + ratio * (max - min));
};

const shiftedDateLabel = (offsetDays: number): string => {
  const next = new Date();
  next.setDate(next.getDate() + offsetDays);
  return next.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const planTypeForTier = (tier: Tier): "IEP" | "504 Plan" | "None" => {
  if (tier === Tier.TIER_3) return "IEP";
  if (tier === Tier.TIER_2) return "504 Plan";
  return "None";
};

const confidenceForTier = (tier: Tier): number => {
  if (tier === Tier.TIER_1) return 84;
  if (tier === Tier.TIER_2) return 89;
  return 93;
};

const buildIntervention = (
  id: number,
  name: string,
  status: "Active" | "Completed",
  baseline: number,
  goal: number,
  trendSeed: number
) => {
  const progress = status === "Completed" ? 100 : Math.min(95, percentFromSeed(trendSeed, 45, 86));
  const steps = [0, 1, 2, 3, 4, 5];
  const dataPoints = steps.map((step) => ({
    date: `Week ${step + 1}`,
    score: Math.round(baseline + ((goal - baseline) * (step + 1)) / (steps.length + 1)),
  }));

  return {
    id,
    name,
    date: shiftedDateLabel(-28 - id * 5),
    status,
    progress,
    baselineScore: baseline,
    goalScore: goal,
    dataPoints,
  };
};

export const buildStudentProfileRecord = (student: StudentRosterLike): StudentProfileRecord => {
  const seed = hashString(`${student.id}:${student.name}`);
  const firstName = student.name.split(" ")[0] ?? student.name;
  const planType = planTypeForTier(student.tier);
  const primaryDisability = planType === "IEP" ? "Specific Learning Disability (Reading)" : undefined;

  const interventions = [
    buildIntervention(1, "Leveled Literacy Intervention", "Active", 45, 85, seed),
    buildIntervention(2, "Check-In/Check-Out", "Completed", 60, 80, seed + 17),
  ];

  return {
    id: student.id,
    name: student.name,
    grade: student.grade,
    teacher: student.teacher ?? "Assigned Teacher",
    tier: student.tier,
    attendance: student.attendance,
    gpa: student.gpa,
    readingLevel: student.readingLevel,
    interventions,
    recentActivity: [
      {
        date: shiftedDateLabel(-2),
        type: "Academic",
        note: `${firstName} completed a targeted skill check with steady growth.`,
        tags: ["Academic", "Progress"],
      },
      {
        date: shiftedDateLabel(-5),
        type: "Behavior",
        note: student.alerts > 0 ? "Behavior redirection was required during independent work." : "Positive peer collaboration noted during workshop.",
        tags: ["Behavior"],
      },
      {
        date: shiftedDateLabel(-9),
        type: "Attendance",
        note: student.attendance < 90 ? "Attendance concern flagged for follow-up." : "Attendance remained stable this week.",
        tags: ["Attendance"],
      },
    ],
    aiRecommendations: [
      {
        id: `${student.id}-rec-1`,
        name: student.tier === Tier.TIER_1 ? "Enrichment Rotation" : "Targeted Small Group",
        reason: `${firstName}'s current tier and reading trend indicate focused instructional support is beneficial.`,
        action: student.tier === Tier.TIER_1
          ? "Add one weekly enrichment cycle tied to current unit objectives."
          : "Schedule a 20-minute small-group intervention block 3x weekly.",
        confidenceLevel: "High",
        confidenceScore: confidenceForTier(student.tier),
      },
      {
        id: `${student.id}-rec-2`,
        name: "Family Communication Touchpoint",
        reason: "Consistent family communication improves follow-through on intervention goals.",
        action: "Send a concise weekly family update with one actionable at-home strategy.",
        confidenceLevel: "Medium",
        confidenceScore: 78,
      },
    ],
    medical: {
      allergies: [],
      medications: [],
      visionScreening: {
        status: "Pass",
        date: shiftedDateLabel(-120),
      },
      hearingScreening: {
        status: "Pass",
        date: shiftedDateLabel(-120),
      },
      conditions: [],
    },
    support: {
      planType,
      primaryDisability,
      nextReviewDate: shiftedDateLabel(45),
      accommodations:
        planType === "None"
          ? []
          : [
              "Preferential seating near instruction",
              "Extended time for independent assessments",
              "Frequent comprehension checks",
            ],
      behavioralStrategies: [
        "Positive reinforcement for task completion",
        "Preview expectations before transitions",
      ],
    },
    updatedAt: new Date().toISOString(),
  };
};

export const syncProfileWithRoster = (
  profile: StudentProfileRecord,
  student: StudentRosterLike
): StudentProfileRecord => ({
  ...profile,
  id: student.id,
  name: student.name,
  grade: student.grade,
  teacher: student.teacher ?? profile.teacher,
  tier: student.tier,
  attendance: student.attendance,
  gpa: student.gpa,
  readingLevel: student.readingLevel,
  updatedAt: new Date().toISOString(),
});
