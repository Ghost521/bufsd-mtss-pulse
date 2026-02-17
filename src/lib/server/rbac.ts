import type { SessionContext } from "./tenant-types";
import type { AppPermissionAction, AppResource, PermissionGrant, RoleKey } from "./tenant-types";

type PermissionCheckInput = {
  resource: AppResource;
  action: AppPermissionAction;
  fields?: string[];
  targetStudentId?: string;
};

const ALL_FIELDS = "*";

const roleGrants: Record<RoleKey, PermissionGrant[]> = {
  org_admin: [
    { resource: "students", action: "read", fields: [ALL_FIELDS] },
    { resource: "students", action: "create", fields: [ALL_FIELDS] },
    { resource: "students", action: "update", fields: [ALL_FIELDS] },
    { resource: "students", action: "delete", fields: [ALL_FIELDS] },
    { resource: "documents", action: "read", fields: [ALL_FIELDS] },
    { resource: "documents", action: "create", fields: [ALL_FIELDS] },
    { resource: "documents", action: "update", fields: [ALL_FIELDS] },
    { resource: "documents", action: "delete", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "read", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "create", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "update", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "delete", fields: [ALL_FIELDS] },
    { resource: "messages", action: "read", fields: [ALL_FIELDS] },
    { resource: "messages", action: "create", fields: [ALL_FIELDS] },
    { resource: "messages", action: "update", fields: [ALL_FIELDS] },
    { resource: "messages", action: "delete", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "read", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "create", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "update", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "delete", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "read", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "create", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "update", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "delete", fields: [ALL_FIELDS] },
    { resource: "dashboard", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "read", fields: [ALL_FIELDS] },
    { resource: "imports", action: "create", fields: [ALL_FIELDS] },
    { resource: "imports", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "delete", fields: [ALL_FIELDS] },
    { resource: "ai", action: "read", fields: [ALL_FIELDS] },
  ],
  district_admin: [
    { resource: "students", action: "read", fields: [ALL_FIELDS] },
    { resource: "students", action: "create", fields: [ALL_FIELDS] },
    { resource: "students", action: "update", fields: [ALL_FIELDS] },
    { resource: "students", action: "delete", fields: [ALL_FIELDS] },
    { resource: "documents", action: "read", fields: [ALL_FIELDS] },
    { resource: "documents", action: "create", fields: [ALL_FIELDS] },
    { resource: "documents", action: "update", fields: [ALL_FIELDS] },
    { resource: "documents", action: "delete", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "read", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "create", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "update", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "delete", fields: [ALL_FIELDS] },
    { resource: "messages", action: "read", fields: [ALL_FIELDS] },
    { resource: "messages", action: "create", fields: [ALL_FIELDS] },
    { resource: "messages", action: "update", fields: [ALL_FIELDS] },
    { resource: "messages", action: "delete", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "read", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "create", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "update", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "delete", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "read", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "create", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "update", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "delete", fields: [ALL_FIELDS] },
    { resource: "dashboard", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "read", fields: [ALL_FIELDS] },
    { resource: "imports", action: "create", fields: [ALL_FIELDS] },
    { resource: "imports", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "delete", fields: [ALL_FIELDS] },
    { resource: "ai", action: "read", fields: [ALL_FIELDS] },
  ],
  principal: [
    { resource: "students", action: "read", fields: [ALL_FIELDS] },
    { resource: "students", action: "create", fields: [ALL_FIELDS] },
    { resource: "students", action: "update", fields: [ALL_FIELDS] },
    { resource: "students", action: "delete", fields: [ALL_FIELDS] },
    { resource: "documents", action: "read", fields: [ALL_FIELDS] },
    { resource: "documents", action: "create", fields: [ALL_FIELDS] },
    { resource: "documents", action: "update", fields: [ALL_FIELDS] },
    { resource: "documents", action: "delete", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "read", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "create", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "update", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "delete", fields: [ALL_FIELDS] },
    { resource: "messages", action: "read", fields: [ALL_FIELDS] },
    { resource: "messages", action: "create", fields: [ALL_FIELDS] },
    { resource: "messages", action: "update", fields: [ALL_FIELDS] },
    { resource: "messages", action: "delete", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "read", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "create", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "update", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "delete", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "read", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "create", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "update", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "delete", fields: [ALL_FIELDS] },
    { resource: "dashboard", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "read", fields: [ALL_FIELDS] },
    { resource: "imports", action: "create", fields: [ALL_FIELDS] },
    { resource: "imports", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "delete", fields: [ALL_FIELDS] },
    { resource: "ai", action: "read", fields: [ALL_FIELDS] },
  ],
  teacher: [
    { resource: "students", action: "read", fields: [ALL_FIELDS] },
    { resource: "students", action: "create", fields: [ALL_FIELDS] },
    { resource: "students", action: "update", fields: ["attendance", "readingLevel", "gpa"] },
    { resource: "documents", action: "read", fields: [ALL_FIELDS] },
    { resource: "documents", action: "create", fields: [ALL_FIELDS] },
    { resource: "documents", action: "update", fields: [ALL_FIELDS] },
    { resource: "documents", action: "delete", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "read", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "create", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "update", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "delete", fields: [ALL_FIELDS] },
    { resource: "messages", action: "read", fields: [ALL_FIELDS] },
    { resource: "messages", action: "create", fields: [ALL_FIELDS] },
    { resource: "messages", action: "update", fields: [ALL_FIELDS] },
    { resource: "messages", action: "delete", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "read", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "create", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "update", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "delete", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "read", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "create", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "update", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "delete", fields: [ALL_FIELDS] },
    { resource: "dashboard", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "read", fields: [ALL_FIELDS] },
    { resource: "imports", action: "create", fields: [ALL_FIELDS] },
    { resource: "imports", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "delete", fields: [ALL_FIELDS] },
    { resource: "ai", action: "read", fields: [ALL_FIELDS] },
  ],
  parent: [
    { resource: "students", action: "read", fields: [ALL_FIELDS] },
    { resource: "documents", action: "read", fields: [ALL_FIELDS] },
    { resource: "documents", action: "create", fields: [ALL_FIELDS] },
    { resource: "documents", action: "update", fields: [ALL_FIELDS] },
    { resource: "documents", action: "delete", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "read", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "create", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "update", fields: [ALL_FIELDS] },
    { resource: "calendar", action: "delete", fields: [ALL_FIELDS] },
    { resource: "messages", action: "read", fields: [ALL_FIELDS] },
    { resource: "messages", action: "create", fields: [ALL_FIELDS] },
    { resource: "messages", action: "update", fields: [ALL_FIELDS] },
    { resource: "messages", action: "delete", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "read", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "create", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "update", fields: [ALL_FIELDS] },
    { resource: "interventions", action: "delete", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "read", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "create", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "update", fields: [ALL_FIELDS] },
    { resource: "lesson_plans", action: "delete", fields: [ALL_FIELDS] },
    { resource: "dashboard", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "read", fields: [ALL_FIELDS] },
    { resource: "settings", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "read", fields: [ALL_FIELDS] },
    { resource: "imports", action: "create", fields: [ALL_FIELDS] },
    { resource: "imports", action: "update", fields: [ALL_FIELDS] },
    { resource: "imports", action: "delete", fields: [ALL_FIELDS] },
    { resource: "ai", action: "read", fields: [ALL_FIELDS] },
  ],
};

const hasGrantForFields = (grant: PermissionGrant, fields: string[] | undefined): boolean => {
  if (!fields || fields.length === 0) return true;
  if (!grant.fields || grant.fields.includes(ALL_FIELDS)) return true;
  return fields.every((field) => grant.fields?.includes(field));
};

const resolveRoleAndGroupGrants = (session: SessionContext): PermissionGrant[] => {
  const rolePermissionSet = session.effectiveRoles.flatMap((role) => roleGrants[role] ?? []);
  const groupPermissionSet = session.groups.flatMap((group) => group.permissions);
  return [...rolePermissionSet, ...groupPermissionSet];
};

const parentOwnsStudent = (session: SessionContext, studentId?: string): boolean => {
  if (!studentId) return false;
  const linked = session.user.linkedStudentIds ?? [];
  return linked.includes(studentId);
};

export const checkPermission = (
  session: SessionContext,
  input: PermissionCheckInput
): { allowed: boolean; reason?: string } => {
  const grants = resolveRoleAndGroupGrants(session).filter(
    (grant) => grant.resource === input.resource && grant.action === input.action
  );

  if (grants.length === 0) {
    return { allowed: false, reason: "No explicit grants for action." };
  }

  const fieldAllowed = grants.some((grant) => hasGrantForFields(grant, input.fields));
  if (!fieldAllowed) {
    return { allowed: false, reason: "Requested fields are not permitted for role/group grants." };
  }

  if (session.effectiveRoles.includes("parent") && input.resource === "students") {
    if (input.action === "read" && !input.targetStudentId) {
      return { allowed: true };
    }
    if (!parentOwnsStudent(session, input.targetStudentId)) {
      return { allowed: false, reason: "Parents can only access linked student records." };
    }
  }

  return { allowed: true };
};

export const requirePermission = (
  session: SessionContext,
  input: PermissionCheckInput
): { ok: true } | { ok: false; status: number; error: string } => {
  const result = checkPermission(session, input);
  if (!result.allowed) {
    return {
      ok: false,
      status: 403,
      error: result.reason ?? "Permission denied.",
    };
  }

  return { ok: true };
};

