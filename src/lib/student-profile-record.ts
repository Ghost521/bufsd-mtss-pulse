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
  academicProgress: NonNullable<StudentDetails["academicProgress"]>;
  readingAssessments: NonNullable<StudentDetails["readingAssessments"]>;
  notes: NonNullable<StudentDetails["notes"]>;
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

const isoDateWithOffset = (offsetDays: number): string => {
  const next = new Date();
  next.setDate(next.getDate() + offsetDays);
  return next.toISOString().slice(0, 10);
};

const isoDateWithMonthOffset = (offsetMonths: number): string => {
  const next = new Date();
  next.setMonth(next.getMonth() + offsetMonths);
  next.setDate(1);
  return next.toISOString().slice(0, 10);
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
    notes: [],
  };
};

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const buildAcademicProgress = (studentId: string, seed: number): NonNullable<StudentDetails["academicProgress"]> => {
  const baseMath = percentFromSeed(seed + 71, 58, 76);
  const baseReading = percentFromSeed(seed + 83, 55, 74);
  const mathGrowth = percentFromSeed(seed + 109, 12, 20);
  const readingGrowth = percentFromSeed(seed + 127, 10, 18);
  const steps = 7;
  const createdAt = new Date().toISOString();

  return Array.from({ length: steps }, (_, index) => {
    const ratio = index / (steps - 1);
    const trendSwing = Math.sin(index * 0.8);
    const mathScore = clampScore(baseMath + mathGrowth * ratio + trendSwing * 2.2);
    const readingScore = clampScore(baseReading + readingGrowth * ratio + Math.cos(index * 0.7) * 2);
    return {
      id: `${studentId}-academic-${index + 1}`,
      date: isoDateWithMonthOffset(index - (steps - 1)),
      mathScore,
      readingScore,
      createdAt,
      updatedAt: createdAt,
    };
  });
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
    academicProgress: buildAcademicProgress(student.id, seed),
    readingAssessments: [
      {
        id: `${student.id}-reading-initial`,
        date: isoDateWithOffset(0),
        fAndPLevel: student.readingLevel,
        notes: "Initial baseline reading assessment.",
        enteredByName: "System",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    notes: [],
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
  academicProgress: profile.academicProgress ?? [],
  readingAssessments: profile.readingAssessments ?? [],
  interventions: (profile.interventions ?? []).map((intervention) => ({
    ...intervention,
    notes: intervention.notes ?? [],
  })),
  notes: profile.notes ?? [],
  updatedAt: new Date().toISOString(),
});
