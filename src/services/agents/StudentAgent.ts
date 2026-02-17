import { BaseAgent } from "./BaseAgent";
import { Tier, type StudentDetails } from "../../types";
import { CLASS_ROSTER_DATA, GLOBAL_ASSIGNMENTS, GLOBAL_GRADES, STAFF_ROSTER_DATA, getStudentDetails } from "../../constants";
import type { Tool } from "@google/genai";
import { Type } from "@google/genai";
import { listStudents, type TenantStudentRecord } from "../../lib/server/student-store";
import type { AgentRequestContext } from "./requestContext";

type StudentToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
  code?: "ACCESS_DENIED" | "INVALID_ARGS" | "NOT_FOUND" | "UNSUPPORTED_TOOL";
};

type HistoricalMetric = "attendance" | "gpa" | "reading_level" | "behavior_incidents";

const safeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeArgs = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const normalizeTier = (value: unknown): Tier | null => {
  const raw = normalizeString(value).toLowerCase();
  if (!raw) return null;
  const matched = Object.values(Tier).find((candidate) => candidate.toLowerCase() === raw);
  return matched ?? null;
};

const matchesName = (candidate: string, lookup: string): boolean => {
  const base = candidate.toLowerCase();
  return base === lookup || base.includes(lookup);
};

const hashSeed = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const pseudoRandom = (seed: number, step: number): number => {
  const x = Math.sin(seed + step * 17.371) * 10000;
  return x - Math.floor(x);
};

const redactSensitiveStudentFields = (student: StudentDetails): StudentDetails => ({
  ...student,
  medical: {
    allergies: [],
    medications: [],
    visionScreening: {
      ...student.medical.visionScreening,
      notes: "Restricted",
    },
    hearingScreening: student.medical.hearingScreening,
    conditions: [],
  },
  support: {
    ...student.support,
    accommodations: [],
    behavioralStrategies: student.support.behavioralStrategies.slice(0, 2),
  },
});

export class StudentAgent extends BaseAgent {
  public readonly tools: Tool[] = [
    {
      functionDeclarations: [
        {
          name: "get_student_details",
          description: "Retrieves role-authorized student records for a specific student.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              studentName: { type: Type.STRING, description: "Full name or partial student name." },
            },
            required: ["studentName"],
          },
        },
        {
          name: "query_student_stats",
          description: "Queries roster-level statistics or filtered student lists in the active tenant scope.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              operation: {
                type: Type.STRING,
                enum: ["count", "list", "average_gpa", "average_attendance"],
                description: "Roster operation to perform.",
              },
              filter_tier: { type: Type.STRING, description: "Optional tier filter (Tier 1, Tier 2, Tier 3)." },
              filter_grade: { type: Type.STRING, description: "Optional grade filter (for example: 4th)." },
              attendance_below: { type: Type.NUMBER, description: "Optional attendance threshold." },
            },
            required: ["operation"],
          },
        },
        {
          name: "get_intervention_fidelity_stats",
          description: "Returns intervention fidelity summary statistics by staff and optional grade-level filtering.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              grade_level: { type: Type.STRING, description: "Optional grade-level filter." },
            },
          },
        },
        {
          name: "get_historical_metrics",
          description: "Returns historical trend data for approved metrics in current tenant scope.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              metric: {
                type: Type.STRING,
                enum: ["attendance", "gpa", "reading_level", "behavior_incidents"],
                description: "Metric to analyze.",
              },
              student_name: { type: Type.STRING, description: "Optional student name for individualized trend." },
              grade_level: { type: Type.STRING, description: "Optional grade-level filter." },
              filter_tier: { type: Type.STRING, description: "Optional tier filter." },
              duration_months: { type: Type.NUMBER, description: "Number of months (default 6, max 24)." },
            },
            required: ["metric"],
          },
        },
        {
          name: "query_gradebook",
          description: "Queries classroom gradebook data for missing work, averages, or assignment-level grades.",
          parameters: {
            type: Type.OBJECT,
            properties: {
              operation: {
                type: Type.STRING,
                enum: ["missing_work", "student_average", "list_grades"],
                description: "Gradebook operation to perform.",
              },
              student_name: { type: Type.STRING, description: "Optional student filter." },
              subject: { type: Type.STRING, description: "Optional subject filter." },
            },
            required: ["operation"],
          },
        },
      ],
    },
  ];

  private listScopedStudents(context: AgentRequestContext, scope: "master" | "class"): TenantStudentRecord[] {
    return listStudents({
      scope,
      context: context.tenantContext,
      requesterUserId: context.sessionUserId,
      requesterRoles: context.effectiveRoles,
    });
  }

  private findAccessibleStudentByName(studentName: string, context: AgentRequestContext): TenantStudentRecord | null {
    const query = normalizeString(studentName).toLowerCase();
    if (!query) return null;

    const scoped = this.listScopedStudents(context, "master");
    const exact = scoped.find((student) => student.name.toLowerCase() === query);
    if (exact) return exact;

    const partial = scoped.find((student) => matchesName(student.name, query));
    if (partial) return partial;

    const classScoped = this.listScopedStudents(context, "class");
    return classScoped.find((student) => matchesName(student.name, query)) ?? null;
  }

  private resolveAllowedClassStudentIds(context: AgentRequestContext): string[] {
    const accessibleNames = new Set(this.listScopedStudents(context, "class").map((student) => student.name.toLowerCase()));
    return CLASS_ROSTER_DATA.filter((student) => accessibleNames.has(student.name.toLowerCase())).map((student) => student.id);
  }

  public executeTool(name: string, args: unknown, context: AgentRequestContext): string {
    const normalizedArgs = normalizeArgs(args);

    let result: StudentToolResult;
    if (name === "get_student_details") {
      result = this.fetchStudentDataSecurely(normalizedArgs.studentName, context);
    } else if (name === "query_student_stats") {
      result = this.executeRosterQuery(normalizedArgs, context);
    } else if (name === "get_intervention_fidelity_stats") {
      result = this.executeFidelityQuery(normalizedArgs, context);
    } else if (name === "get_historical_metrics") {
      result = this.executeHistoricalQuery(normalizedArgs, context);
    } else if (name === "query_gradebook") {
      result = this.executeGradebookQuery(normalizedArgs, context);
    } else {
      result = { ok: false, error: `Unsupported student tool: ${name}`, code: "UNSUPPORTED_TOOL" };
    }

    return JSON.stringify(result);
  }

  public fetchStudentDataSecurely(targetStudentName: unknown, context: AgentRequestContext): StudentToolResult {
    if (!context.toolPolicy.canReadStudentDetails) {
      return { ok: false, error: "Access denied for student detail lookups.", code: "ACCESS_DENIED" };
    }

    const query = normalizeString(targetStudentName);
    if (!query) {
      return { ok: false, error: "Missing required field: studentName.", code: "INVALID_ARGS" };
    }

    const student = this.findAccessibleStudentByName(query, context);
    if (!student) {
      return { ok: false, error: "Student not found in your authorized scope.", code: "NOT_FOUND" };
    }

    const details = getStudentDetails(student.name);
    const hydrated: StudentDetails = {
      ...details,
      id: student.id,
      name: student.name,
      grade: student.grade,
      tier: student.tier,
      gpa: student.gpa,
      attendance: student.attendance,
      readingLevel: student.readingLevel,
    };

    return {
      ok: true,
      data: {
        student: context.toolPolicy.canSeePII ? hydrated : redactSensitiveStudentFields(hydrated),
        source: "tenant-student-store",
      },
    };
  }

  public executeRosterQuery(args: Record<string, unknown>, context: AgentRequestContext): StudentToolResult {
    if (!context.toolPolicy.canReadRoster) {
      return { ok: false, error: "Access denied for roster statistics.", code: "ACCESS_DENIED" };
    }

    const operation = normalizeString(args.operation);
    const allowedOps = new Set(["count", "list", "average_gpa", "average_attendance"]);
    if (!allowedOps.has(operation)) {
      return { ok: false, error: "Invalid operation. Allowed: count, list, average_gpa, average_attendance.", code: "INVALID_ARGS" };
    }

    const scope = context.toolPolicy.canQueryAcrossSchool ? "master" : "class";
    let filtered = this.listScopedStudents(context, scope);

    const tier = normalizeTier(args.filter_tier);
    if (args.filter_tier !== undefined && !tier) {
      return { ok: false, error: "Invalid tier filter. Expected one of Tier 1, Tier 2, Tier 3.", code: "INVALID_ARGS" };
    }

    const grade = normalizeString(args.filter_grade);
    const attendanceBelow = safeNumber(args.attendance_below);
    if (args.attendance_below !== undefined && attendanceBelow === null) {
      return { ok: false, error: "attendance_below must be a number.", code: "INVALID_ARGS" };
    }

    if (tier) filtered = filtered.filter((student) => student.tier === tier);
    if (grade) filtered = filtered.filter((student) => student.grade.toLowerCase().includes(grade.toLowerCase()));
    if (attendanceBelow !== null) filtered = filtered.filter((student) => student.attendance < attendanceBelow);

    if (operation === "count") {
      return {
        ok: true,
        data: {
          count: filtered.length,
          scope,
          filters: { tier, grade: grade || null, attendanceBelow },
        },
      };
    }

    if (operation === "average_gpa") {
      const numeric = filtered
        .map((student) => Number.parseFloat(student.gpa))
        .filter((value) => Number.isFinite(value));
      const average = numeric.length > 0 ? Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(2)) : null;

      return {
        ok: true,
        data: {
          average_gpa: average,
          sample_size: numeric.length,
          scope,
        },
      };
    }

    if (operation === "average_attendance") {
      const average =
        filtered.length > 0
          ? Number((filtered.reduce((sum, student) => sum + student.attendance, 0) / filtered.length).toFixed(1))
          : null;

      return {
        ok: true,
        data: {
          average_attendance: average,
          sample_size: filtered.length,
          scope,
        },
      };
    }

    return {
      ok: true,
      data: {
        scope,
        total: filtered.length,
        students: filtered.slice(0, 50).map((student) => ({
          id: student.id,
          name: student.name,
          grade: student.grade,
          tier: student.tier,
          gpa: student.gpa,
          attendance: student.attendance,
        })),
      },
    };
  }

  public executeFidelityQuery(args: Record<string, unknown>, context: AgentRequestContext): StudentToolResult {
    if (!context.toolPolicy.canReadFidelity) {
      return { ok: false, error: "Access denied for intervention fidelity analytics.", code: "ACCESS_DENIED" };
    }

    const gradeLevel = normalizeString(args.grade_level);
    let targetStaff = [...STAFF_ROSTER_DATA];
    if (gradeLevel) {
      targetStaff = targetStaff.filter((staff) => (staff.grade ?? "").toLowerCase().includes(gradeLevel.toLowerCase()));
    }

    if (targetStaff.length === 0) {
      return { ok: false, error: "No staff records matched the provided filter.", code: "NOT_FOUND" };
    }

    const scores = targetStaff.map((staff) => staff.mtssFidelityScore);
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    const lowest = Math.min(...scores);
    const highest = Math.max(...scores);

    return {
      ok: true,
      data: {
        average_fidelity: `${average}%`,
        lowest_fidelity: `${lowest}%`,
        highest_fidelity: `${highest}%`,
        sample_size: targetStaff.length,
        grade_filter: gradeLevel || null,
      },
    };
  }

  public executeHistoricalQuery(args: Record<string, unknown>, context: AgentRequestContext): StudentToolResult {
    if (!context.toolPolicy.canReadHistorical) {
      return { ok: false, error: "Access denied for historical metrics.", code: "ACCESS_DENIED" };
    }

    const metric = normalizeString(args.metric) as HistoricalMetric;
    const allowedMetrics: HistoricalMetric[] = ["attendance", "gpa", "reading_level", "behavior_incidents"];
    if (!allowedMetrics.includes(metric)) {
      return { ok: false, error: "Invalid metric. Allowed: attendance, gpa, reading_level, behavior_incidents.", code: "INVALID_ARGS" };
    }

    const rawDuration = safeNumber(args.duration_months);
    const durationMonths = rawDuration === null ? 6 : Math.max(1, Math.min(24, Math.round(rawDuration)));
    const studentName = normalizeString(args.student_name);
    const tier = normalizeTier(args.filter_tier);
    const gradeLevel = normalizeString(args.grade_level);

    let student: TenantStudentRecord | null = null;
    if (studentName) {
      student = this.findAccessibleStudentByName(studentName, context);
      if (!student) {
        return { ok: false, error: "Requested student is outside your authorized scope.", code: "ACCESS_DENIED" };
      }
    }

    const seedBasis = `${context.sessionUserId}|${metric}|${student?.id ?? gradeLevel ?? tier ?? "scope"}`;
    const seed = hashSeed(seedBasis);

    const baseline =
      metric === "attendance" ? 89 : metric === "gpa" ? 2.8 : metric === "reading_level" ? 10 : 4;
    const variance =
      metric === "attendance" ? 3.2 : metric === "gpa" ? 0.35 : metric === "reading_level" ? 1.6 : 1.2;

    const now = new Date();
    const points = Array.from({ length: durationMonths }).map((_, index) => {
      const monthIndex = durationMonths - index;
      const bucket = new Date(now.getFullYear(), now.getMonth() - monthIndex + 1, 1);
      const jitter = pseudoRandom(seed, index) - 0.5;
      const directional = (index / Math.max(1, durationMonths - 1)) * 0.6;
      const raw = baseline + jitter * variance + directional;
      const value = metric === "gpa" ? Number(raw.toFixed(2)) : Number(Math.max(0, raw).toFixed(1));
      return {
        month: bucket.toISOString().slice(0, 7),
        value,
      };
    });

    const delta = points[points.length - 1].value - points[0].value;
    const trend = Math.abs(delta) < 0.15 ? "stable" : delta > 0 ? "improving" : "declining";

    return {
      ok: true,
      data: {
        metric,
        trend,
        duration_months: durationMonths,
        student: student ? { id: student.id, name: student.name } : null,
        grade_level: gradeLevel || null,
        tier: tier ?? null,
        points,
      },
    };
  }

  public executeGradebookQuery(args: Record<string, unknown>, context: AgentRequestContext): StudentToolResult {
    if (!context.toolPolicy.canReadGradebook) {
      return { ok: false, error: "Access denied for gradebook queries.", code: "ACCESS_DENIED" };
    }

    const operation = normalizeString(args.operation);
    const allowedOps = new Set(["missing_work", "student_average", "list_grades"]);
    if (!allowedOps.has(operation)) {
      return { ok: false, error: "Invalid operation. Allowed: missing_work, student_average, list_grades.", code: "INVALID_ARGS" };
    }

    const subject = normalizeString(args.subject).toLowerCase();
    const studentName = normalizeString(args.student_name);

    const allowedStudentIds = new Set(this.resolveAllowedClassStudentIds(context));
    if (allowedStudentIds.size === 0) {
      return { ok: false, error: "No gradebook records are available in your current scope.", code: "NOT_FOUND" };
    }

    const rosterMap = new Map(CLASS_ROSTER_DATA.map((student) => [student.id, student]));
    const assignmentsMap = new Map(GLOBAL_ASSIGNMENTS.map((assignment) => [assignment.id, assignment]));

    let selectedStudentIds = new Set(allowedStudentIds);
    if (studentName) {
      const matched = CLASS_ROSTER_DATA.find(
        (student) =>
          allowedStudentIds.has(student.id) &&
          matchesName(student.name, studentName.toLowerCase())
      );

      if (!matched) {
        return { ok: false, error: "Student not found in your gradebook scope.", code: "NOT_FOUND" };
      }
      selectedStudentIds = new Set([matched.id]);
    }

    const rows = GLOBAL_GRADES
      .filter((entry) => selectedStudentIds.has(entry.studentId))
      .map((entry) => {
        const student = rosterMap.get(entry.studentId);
        const assignment = assignmentsMap.get(entry.assignmentId);
        if (!student || !assignment) return null;
        return {
          studentId: student.id,
          studentName: student.name,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          subject: assignment.subject,
          date: assignment.date,
          score: entry.score,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => (subject ? row.subject.toLowerCase() === subject : true));

    if (operation === "missing_work") {
      const missing = rows.filter((row) => row.score === "M");
      return {
        ok: true,
        data: {
          missing_count: missing.length,
          students_affected: [...new Set(missing.map((row) => row.studentName))].length,
          items: missing.slice(0, 30),
        },
      };
    }

    if (operation === "student_average") {
      if (!studentName) {
        return { ok: false, error: "student_name is required for student_average.", code: "INVALID_ARGS" };
      }

      const numericScores = rows
        .map((row) => (typeof row.score === "number" ? row.score : null))
        .filter((score): score is number => score !== null);

      if (numericScores.length === 0) {
        return { ok: true, data: { average: null, graded_items: 0, subject: subject || null } };
      }

      const average = Number((numericScores.reduce((sum, score) => sum + score, 0) / numericScores.length).toFixed(2));
      return {
        ok: true,
        data: {
          average,
          graded_items: numericScores.length,
          subject: subject || null,
        },
      };
    }

    return {
      ok: true,
      data: {
        total: rows.length,
        rows: rows
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 50),
      },
    };
  }
}
