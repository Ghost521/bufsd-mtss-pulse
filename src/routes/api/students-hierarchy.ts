import { createFileRoute } from "@tanstack/react-router";
import { newRequestId } from "../../lib/server/audit-log";
import { appendActivityCookie, getSessionAuthFailureReason, getSessionFromRequest } from "../../lib/server/auth-context";
import { requirePermission } from "../../lib/server/rbac";
import { listStudents, type TenantStudentRecord } from "../../lib/server/student-store";
import { getMemberships, getSchools, getUsers } from "../../lib/server/tenant-store";

type RoleScope = "district" | "school" | "teacher";

type TeacherNode = {
  teacherUserId: string | null;
  teacherName: string;
  studentCount: number;
};

type GradeNode = {
  grade: string;
  teachers: TeacherNode[];
};

type PrincipalNode = {
  principalUserId: string;
  principalName: string;
  isPlaceholder: boolean;
  grades: GradeNode[];
};

type SchoolNode = {
  schoolId: string;
  schoolName: string;
  studentCount: number;
  principals: PrincipalNode[];
  grades: GradeNode[];
};

const normalizeText = (value: string): string => value.trim().toLowerCase();

const resolveRoleScope = (roles: string[]): RoleScope => {
  if (roles.includes("district_admin") || roles.includes("org_admin")) return "district";
  if (roles.includes("principal") || roles.includes("school_admin")) return "school";
  return "teacher";
};

const gradeSortWeight = (grade: string): number => {
  const value = Number.parseInt(grade, 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

const sortGrades = (grades: string[]): string[] =>
  [...grades].sort((left, right) => {
    const leftWeight = gradeSortWeight(left);
    const rightWeight = gradeSortWeight(right);
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
    return left.localeCompare(right);
  });

const buildGradeNodes = (rows: TenantStudentRecord[]): GradeNode[] => {
  const byGrade = new Map<string, TenantStudentRecord[]>();
  for (const row of rows) {
    const bucket = byGrade.get(row.grade);
    if (bucket) bucket.push(row);
    else byGrade.set(row.grade, [row]);
  }

  return sortGrades([...byGrade.keys()]).map((grade) => {
    const gradeRows = byGrade.get(grade) ?? [];
    const byTeacher = new Map<string, { id: string | null; name: string; count: number }>();

    for (const row of gradeRows) {
      const teacherName = row.teacherName ?? row.teacher ?? "Unassigned";
      const teacherId = row.teacherUserId ?? null;
      const key = teacherId ?? `name:${normalizeText(teacherName)}`;
      const existing = byTeacher.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byTeacher.set(key, {
          id: teacherId,
          name: teacherName,
          count: 1,
        });
      }
    }

    const teachers: TeacherNode[] = [...byTeacher.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((teacher) => ({
        teacherUserId: teacher.id,
        teacherName: teacher.name,
        studentCount: teacher.count,
      }));

    return { grade, teachers };
  });
};

const cloneGrades = (grades: GradeNode[]): GradeNode[] =>
  grades.map((grade) => ({
    grade: grade.grade,
    teachers: grade.teachers.map((teacher) => ({ ...teacher })),
  }));

const buildPrincipalNodes = (schoolId: string, grades: GradeNode[]): PrincipalNode[] => {
  const memberships = getMemberships().filter(
    (membership) =>
      membership.status === "active" &&
      membership.scopeType === "school" &&
      membership.scopeId === schoolId &&
      (membership.role === "principal" || membership.role === "school_admin")
  );
  const users = new Map(getUsers().map((user) => [user.id, user]));

  const leaders = memberships
    .map((membership) => ({
      principalUserId: membership.userId,
      principalName: users.get(membership.userId)?.name ?? membership.userId,
      isPlaceholder: false,
      roleOrder: membership.role === "principal" ? 0 : 1,
    }))
    .sort((left, right) => {
      if (left.roleOrder !== right.roleOrder) return left.roleOrder - right.roleOrder;
      return left.principalName.localeCompare(right.principalName);
    });

  const deduped: PrincipalNode[] = [];
  const seen = new Set<string>();
  for (const leader of leaders) {
    if (seen.has(leader.principalUserId)) continue;
    seen.add(leader.principalUserId);
    deduped.push({
      principalUserId: leader.principalUserId,
      principalName: leader.principalName,
      isPlaceholder: false,
      grades: cloneGrades(grades),
    });
  }

  if (deduped.length > 0) return deduped;

  return [
    {
      principalUserId: `none:${schoolId}`,
      principalName: "No principal assigned",
      isPlaceholder: true,
      grades: cloneGrades(grades),
    },
  ];
};

export const Route = createFileRoute("/api/students-hierarchy")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        const permission = requirePermission(session, { resource: "students", action: "read" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const roleScope = resolveRoleScope(session.effectiveRoles);
        const scope = roleScope === "teacher" ? "class" : "master";
        const rows = await listStudents({
          scope,
          context: session.activeContext,
          requesterUserId: session.user.id,
          requesterRoles: session.effectiveRoles,
        });

        const bySchool = new Map<string, TenantStudentRecord[]>();
        for (const row of rows) {
          const bucket = bySchool.get(row.schoolId);
          if (bucket) bucket.push(row);
          else bySchool.set(row.schoolId, [row]);
        }

        const schoolNames = new Map(getSchools().map((school) => [school.id, school.name]));

        const schools: SchoolNode[] = [...bySchool.entries()]
          .map(([schoolId, schoolRows]) => {
            const grades = buildGradeNodes(schoolRows);
            return {
              schoolId,
              schoolName: schoolNames.get(schoolId) ?? schoolId,
              studentCount: schoolRows.length,
              grades,
              principals: buildPrincipalNodes(schoolId, grades),
            };
          })
          .sort((left, right) => left.schoolName.localeCompare(right.schoolName));

        return appendActivityCookie(
          Response.json({
            ok: true,
            roleScope,
            schools,
            requestId,
          })
        );
      },
    },
  },
});
