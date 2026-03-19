import type { SessionContext } from "./tenant-types";
import type { AppPermissionAction, AppResource, PermissionGrant, RoleKey } from "./tenant-types";

type PermissionCheckInput = {
  resource: AppResource;
  action: AppPermissionAction;
  fields?: string[];
  targetStudentId?: string;
};

type PermissionDeniedCode =
  | "NO_GRANT"
  | "EXPLICIT_DENY"
  | "FIELD_DENIED"
  | "SUBJECT_DENIED";

type PermissionCheckResult = {
  allowed: boolean;
  reason?: string;
  code?: PermissionDeniedCode;
};

const ALL_FIELDS = "*";
const CRUD_ACTIONS: AppPermissionAction[] = ["read", "create", "update", "delete"];
const READ_ONLY_ACTIONS: AppPermissionAction[] = ["read"];
const READ_WRITE_ACTIONS: AppPermissionAction[] = ["read", "create", "update"];

const allow = (
  resource: AppResource,
  actions: AppPermissionAction[] = CRUD_ACTIONS,
  fields?: string[]
): PermissionGrant[] =>
  actions.map((action) => ({
    resource,
    action,
    fields,
    effect: "allow",
  }));

const elevatedRoleGrants: PermissionGrant[] = [
  ...allow("students", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("student_profiles", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("staff", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("gradebook_assignments", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("gradebook_grades", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("documents", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("calendar", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("notifications", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("messages", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("interventions", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("referrals", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("lesson_plans", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("imports", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("dashboard", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("reports", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("audit", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("settings", ["read", "update"], [ALL_FIELDS]),
  ...allow("ai", READ_ONLY_ACTIONS, [ALL_FIELDS]),
];

const teacherRoleGrants: PermissionGrant[] = [
  ...allow("students", ["read", "create"], [ALL_FIELDS]),
  ...allow("students", ["update"], ["attendance", "readingLevel", "gpa"]),
  ...allow("student_profiles", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("staff", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("gradebook_assignments", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("gradebook_grades", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("documents", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("calendar", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("notifications", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("messages", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("interventions", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("referrals", READ_WRITE_ACTIONS, [ALL_FIELDS]),
  ...allow("lesson_plans", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("imports", READ_WRITE_ACTIONS, [ALL_FIELDS]),
  ...allow("dashboard", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("reports", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("settings", ["read", "update"], [ALL_FIELDS]),
  ...allow("ai", READ_ONLY_ACTIONS, [ALL_FIELDS]),
];

const parentRoleGrants: PermissionGrant[] = [
  ...allow("students", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("staff", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("gradebook_assignments", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("gradebook_grades", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("documents", ["read", "create"], [ALL_FIELDS]),
  ...allow("calendar", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("notifications", CRUD_ACTIONS, [ALL_FIELDS]),
  ...allow("messages", ["read", "create"], [ALL_FIELDS]),
  ...allow("interventions", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("referrals", ["read", "create"], [ALL_FIELDS]),
  ...allow("lesson_plans", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("dashboard", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("reports", READ_ONLY_ACTIONS, [ALL_FIELDS]),
  ...allow("settings", ["read", "update"], [ALL_FIELDS]),
  ...allow("ai", READ_ONLY_ACTIONS, [ALL_FIELDS]),
];

const roleGrants: Record<RoleKey, PermissionGrant[]> = {
  org_admin: elevatedRoleGrants,
  district_admin: elevatedRoleGrants,
  principal: elevatedRoleGrants,
  school_admin: elevatedRoleGrants,
  teacher: teacherRoleGrants,
  parent: parentRoleGrants,
};

const permissionGrantsCache = new WeakMap<SessionContext, PermissionGrant[]>();
const permissionIndexCache = new WeakMap<SessionContext, Map<string, PermissionGrant[]>>();

const permissionKey = (resource: AppResource, action: AppPermissionAction): string => `${resource}:${action}`;

const hasGrantForFields = (grant: PermissionGrant, fields: string[] | undefined): boolean => {
  if (!fields || fields.length === 0) return true;
  if (!grant.fields || grant.fields.includes(ALL_FIELDS)) return true;
  return fields.every((field) => grant.fields?.includes(field));
};

const resolveRoleAndGroupGrants = (session: SessionContext): PermissionGrant[] => {
  const cached = permissionGrantsCache.get(session);
  if (cached) return cached;

  const rolePermissionSet = session.effectiveRoles.flatMap((role) => roleGrants[role] ?? []);
  const groupPermissionSet = session.groups.flatMap((group) => group.permissions);
  const grants = [...rolePermissionSet, ...groupPermissionSet];
  permissionGrantsCache.set(session, grants);
  return grants;
};

const compileGrantIndex = (session: SessionContext): Map<string, PermissionGrant[]> => {
  const cached = permissionIndexCache.get(session);
  if (cached) return cached;

  const index = new Map<string, PermissionGrant[]>();
  for (const grant of resolveRoleAndGroupGrants(session)) {
    const key = permissionKey(grant.resource, grant.action);
    const bucket = index.get(key);
    if (bucket) {
      bucket.push(grant);
    } else {
      index.set(key, [grant]);
    }
  }

  permissionIndexCache.set(session, index);
  return index;
};

const parentOwnsStudent = (session: SessionContext, studentId?: string): boolean => {
  if (!studentId) return false;
  const linked = session.user.linkedStudentIds ?? [];
  return linked.includes(studentId);
};

export const checkPermission = (session: SessionContext, input: PermissionCheckInput): PermissionCheckResult => {
  const grants = compileGrantIndex(session).get(permissionKey(input.resource, input.action)) ?? [];
  if (grants.length === 0) {
    return { allowed: false, reason: "No explicit grants for action.", code: "NO_GRANT" };
  }

  const explicitlyDenied = grants.some(
    (grant) => (grant.effect ?? "allow") === "deny" && hasGrantForFields(grant, input.fields)
  );
  if (explicitlyDenied) {
    return { allowed: false, reason: "Action is explicitly denied by policy.", code: "EXPLICIT_DENY" };
  }

  const fieldAllowed = grants.some(
    (grant) => (grant.effect ?? "allow") === "allow" && hasGrantForFields(grant, input.fields)
  );
  if (!fieldAllowed) {
    return {
      allowed: false,
      reason: "Requested fields are not permitted for role/group grants.",
      code: "FIELD_DENIED",
    };
  }

  if (session.effectiveRoles.includes("parent") && input.resource === "students") {
    if (input.action === "read" && !input.targetStudentId) {
      return { allowed: true };
    }
    if (!parentOwnsStudent(session, input.targetStudentId)) {
      return {
        allowed: false,
        reason: "Parents can only access linked student records.",
        code: "SUBJECT_DENIED",
      };
    }
  }

  if (session.effectiveRoles.includes("parent") && input.resource === "student_profiles") {
    if (!parentOwnsStudent(session, input.targetStudentId)) {
      return {
        allowed: false,
        reason: "Parents can only access linked student profiles.",
        code: "SUBJECT_DENIED",
      };
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
