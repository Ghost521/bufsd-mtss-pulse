import { listStudents } from "./student-store";
import { listDomainRows } from "./collection-store";
import type { SessionContext } from "./tenant-types";
import { getSchools } from "./tenant-store";
import { Tier, Trend, UserRole, type ActionItem, type DashboardData, type MetricData, type StudentMonitoring } from "../../types";

type InterventionRow = {
  id: string;
  studentName?: string;
  planName?: string;
  progress?: number;
};

const isDistrictRole = (session: SessionContext): boolean =>
  session.effectiveRoles.includes("district_admin") || session.effectiveRoles.includes("org_admin");

const roleFromRequest = (raw: string | null | undefined, fallback: UserRole): UserRole => {
  if (raw === UserRole.PRINCIPAL) return UserRole.PRINCIPAL;
  if (raw === UserRole.TEACHER) return UserRole.TEACHER;
  if (raw === UserRole.DISTRICT) return UserRole.DISTRICT;
  if (raw === UserRole.PARENT) return UserRole.PARENT;
  return fallback;
};

const roleKeyToUserRole = (role: string): UserRole | null => {
  if (role === "teacher") return UserRole.TEACHER;
  if (role === "principal" || role === "school_admin") return UserRole.PRINCIPAL;
  if (role === "district_admin" || role === "org_admin") return UserRole.DISTRICT;
  if (role === "parent") return UserRole.PARENT;
  return null;
};

export const deriveWorkspaceRole = (session: SessionContext, raw?: string | null): UserRole => {
  const fallback = isDistrictRole(session)
    ? UserRole.DISTRICT
    : session.effectiveRoles.includes("principal") || session.effectiveRoles.includes("school_admin")
      ? UserRole.PRINCIPAL
      : session.effectiveRoles.includes("parent")
        ? UserRole.PARENT
        : UserRole.TEACHER;

  const requested = roleFromRequest(raw, fallback);
  const allowedRoles = new Set(
    session.effectiveRoles
      .map((role) => roleKeyToUserRole(role))
      .filter((role): role is UserRole => role !== null),
  );

  return allowedRoles.has(requested) ? requested : fallback;
};

const buildSchoolName = (session: SessionContext): string => {
  const schoolId = session.activeContext.schoolId;
  if (!schoolId) return isDistrictRole(session) ? "District-wide" : "Workspace";
  return getSchools().find((school) => school.id === schoolId)?.name ?? schoolId;
};

const getTierDistribution = (tiers: Tier[]) => {
  const total = Math.max(1, tiers.length);
  const countByTier = {
    [Tier.TIER_1]: 0,
    [Tier.TIER_2]: 0,
    [Tier.TIER_3]: 0,
  };
  tiers.forEach((tier) => {
    countByTier[tier] += 1;
  });
  return [Tier.TIER_1, Tier.TIER_2, Tier.TIER_3].map((tier) => ({
    tier,
    count: countByTier[tier],
    percentage: Math.round((countByTier[tier] / total) * 100),
  }));
};

const buildMetrics = (input: {
  interventionCount: number;
  flaggedCount: number;
  meetingsCount: number;
  fidelityPercent: number;
}): MetricData[] => [
  {
    label: "Intervention Fidelity",
    value: `${input.fidelityPercent}%`,
    trend: "+1%",
    trendDirection: "up",
    metricWindow: "Last 7 days",
    metricBaseline: "vs prior week",
    status: "success",
    icon: "Activity",
  },
  {
    label: "Active Interventions",
    value: input.interventionCount,
    trend: `${input.interventionCount} Open`,
    trendDirection: "up",
    metricWindow: "Current week",
    metricBaseline: "rolling workload",
    status: "neutral",
    icon: "Zap",
  },
  {
    label: "Students Flagged",
    value: input.flaggedCount,
    trend: input.flaggedCount > 0 ? "Requires Review" : "Stable",
    trendDirection: input.flaggedCount > 0 ? "up" : "down",
    metricWindow: "Current cycle",
    metricBaseline: "risk threshold",
    status: input.flaggedCount > 0 ? "danger" : "success",
    icon: "AlertCircle",
  },
  {
    label: "MTSS Meetings",
    value: input.meetingsCount,
    trend: "This Week",
    trendDirection: "up",
    metricWindow: "7-day window",
    metricBaseline: "scheduled sessions",
    status: "neutral",
    icon: "Users",
  },
];

const toActionItems = (
  rows: Array<{ id: string; name: string; grade: string; attendance: number; tier: Tier; alerts: number }>
): ActionItem[] =>
  rows.slice(0, 5).map((row, index) => {
    const category: ActionItem["category"] =
      row.attendance < 90 ? "Attendance" : row.tier === Tier.TIER_3 ? "Behavior" : row.alerts > 0 ? "Academic" : "System";
    const insight =
      row.attendance < 90
        ? `Signal: Attendance dropped to ${row.attendance}%.`
        : row.alerts > 0
          ? `Signal: ${row.alerts} active alert${row.alerts > 1 ? "s" : ""} requires review.`
          : `Signal: ${row.name} remains in ${row.tier} support track.`;
    return {
      id: row.id || `action-${index}`,
      studentName: row.name,
      grade: row.grade,
      category,
      insight,
      isAiDetected: true,
    };
  });

const toMonitoringPulse = (
  interventions: InterventionRow[],
  rows: Array<{ id: string; name: string }>
): StudentMonitoring[] => {
  const progressByStudent = new Map<string, number>();
  interventions.forEach((item) => {
    if (!item.studentName || typeof item.progress !== "number") return;
    progressByStudent.set(item.studentName.toLowerCase(), item.progress);
  });

  return rows.slice(0, 4).map((row) => {
    const progress = progressByStudent.get(row.name.toLowerCase()) ?? 70;
    const trend = progress >= 85 ? Trend.MET : progress >= 70 ? Trend.UP : progress >= 50 ? Trend.STAGNANT : Trend.DOWN;
    return {
      id: row.id,
      name: row.name,
      intervention: interventions.find((item) => item.studentName?.toLowerCase() === row.name.toLowerCase())?.planName || "MTSS Plan",
      trend,
    };
  });
};

export const getDashboardData = async (session: SessionContext, role: UserRole): Promise<DashboardData> => {
  const students = await listStudents({
    scope: role === UserRole.DISTRICT || role === UserRole.PRINCIPAL ? "master" : "class",
    context: session.activeContext,
    requesterUserId: session.user.id,
    requesterRoles: session.effectiveRoles,
  });
  const interventions = await listDomainRows<InterventionRow>(session, "interventions");
  const calendarEvents = await listDomainRows<{ type?: string; start?: string }>(session, "calendar");

  const flaggedStudents = students.filter((student) => student.alerts > 0 || student.attendance < 90 || student.tier !== Tier.TIER_1);
  const meetingsThisWeek = calendarEvents.filter((event) => {
    if (!event.start) return false;
    const start = new Date(event.start);
    const now = new Date();
    const diffDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= -7 && diffDays <= 7;
  }).length;
  const fidelityPercent = interventions.length > 0
    ? Math.max(55, Math.min(99, Math.round(interventions.reduce((acc, item) => acc + (item.progress ?? 70), 0) / interventions.length)))
    : 92;

  const tierDistribution = getTierDistribution(students.map((student) => student.tier));

  return {
    role,
    userName: session.user.name,
    schoolName: buildSchoolName(session),
    metrics: buildMetrics({
      interventionCount: interventions.length,
      flaggedCount: flaggedStudents.length,
      meetingsCount: meetingsThisWeek,
      fidelityPercent,
    }),
    actionItems: toActionItems(flaggedStudents),
    tierDistribution,
    monitoringPulse: toMonitoringPulse(interventions, students),
    chartData: tierDistribution.map((entry) => ({
      name: entry.tier,
      value: entry.count,
      fill: entry.tier === Tier.TIER_1 ? "#10b981" : entry.tier === Tier.TIER_2 ? "#f59e0b" : "#ef4444",
    })),
    chartTitle: role === UserRole.TEACHER ? "Class Intervention Effectiveness" : "Intervention Effectiveness",
  };
};
