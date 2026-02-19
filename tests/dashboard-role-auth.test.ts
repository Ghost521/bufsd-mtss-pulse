import { describe, expect, it } from "vitest";
import { UserRole } from "../src/types";
import { deriveWorkspaceRole } from "../src/lib/server/dashboard-store";
import type { SessionContext, RoleKey } from "../src/lib/server/tenant-types";

const createSession = (roles: RoleKey[]): SessionContext => ({
  user: {
    id: "u-test",
    name: "Test User",
    email: "test@example.org",
    primaryRole: roles[0] ?? "teacher",
    linkedStudentIds: [],
  },
  memberships: [],
  groups: [],
  activeContext: {
    organizationId: "org-bufsd",
    districtId: "dist-bufsd",
    schoolId: "sch-ne",
  },
  effectiveRoles: roles,
});

describe("deriveWorkspaceRole", () => {
  it("ignores requested roles outside effective role grants", () => {
    const teacherSession = createSession(["teacher"]);
    const requestedDistrictRole = deriveWorkspaceRole(teacherSession, UserRole.DISTRICT);
    expect(requestedDistrictRole).toBe(UserRole.TEACHER);
  });

  it("allows requested roles when present in effective role grants", () => {
    const multiRoleSession = createSession(["teacher", "principal"]);
    const requestedPrincipalRole = deriveWorkspaceRole(multiRoleSession, UserRole.PRINCIPAL);
    expect(requestedPrincipalRole).toBe(UserRole.PRINCIPAL);
  });

  it("maps school admin effective role to principal workspace role", () => {
    const schoolAdminSession = createSession(["school_admin"]);
    const derivedRole = deriveWorkspaceRole(schoolAdminSession);
    expect(derivedRole).toBe(UserRole.PRINCIPAL);
  });
});
