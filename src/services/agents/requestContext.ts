import type { SessionContext, RoleKey } from "../../lib/server/tenant-types";
import { UserRole } from "../../types";

export type AgentToolPolicy = {
  canReadRoster: boolean;
  canReadStudentDetails: boolean;
  canReadFidelity: boolean;
  canReadHistorical: boolean;
  canReadGradebook: boolean;
  canSeePII: boolean;
  canQueryAcrossSchool: boolean;
};

export type AgentRequestContext = {
  requestId: string;
  sessionUserId: string;
  username: string;
  userRole: UserRole;
  effectiveRoles: RoleKey[];
  linkedStudentIds: string[];
  tenantContext: SessionContext["activeContext"];
  toolPolicy: AgentToolPolicy;
};

const elevatedRoles: RoleKey[] = ["org_admin", "district_admin", "principal"];

const hasRole = (roles: RoleKey[], role: RoleKey): boolean => roles.includes(role);

const hasAnyRole = (roles: RoleKey[], checkRoles: RoleKey[]): boolean =>
  checkRoles.some((role) => hasRole(roles, role));

export const mapRoleToUserRole = (role: RoleKey): UserRole => {
  if (role === "teacher") return UserRole.TEACHER;
  if (role === "principal") return UserRole.PRINCIPAL;
  if (role === "district_admin" || role === "org_admin") return UserRole.DISTRICT;
  if (role === "parent") return UserRole.PARENT;
  return UserRole.TEACHER;
};

export const deriveToolPolicy = (roles: RoleKey[]): AgentToolPolicy => {
  const elevated = hasAnyRole(roles, elevatedRoles);
  const teacher = hasRole(roles, "teacher");
  const parent = hasRole(roles, "parent");

  return {
    canReadRoster: elevated || teacher,
    canReadStudentDetails: elevated || teacher || parent,
    canReadFidelity: elevated || teacher,
    canReadHistorical: elevated || teacher || parent,
    canReadGradebook: elevated || teacher || parent,
    canSeePII: elevated || teacher,
    canQueryAcrossSchool: elevated,
  };
};

export const buildAgentRequestContext = (session: SessionContext, requestId: string): AgentRequestContext => {
  const effectiveRoles = session.effectiveRoles.length > 0 ? [...session.effectiveRoles] : [session.user.primaryRole];
  const primaryRole = effectiveRoles[0] ?? session.user.primaryRole;

  return {
    requestId,
    sessionUserId: session.user.id,
    username: session.user.name,
    userRole: mapRoleToUserRole(primaryRole),
    effectiveRoles,
    linkedStudentIds: [...(session.user.linkedStudentIds ?? [])],
    tenantContext: session.activeContext,
    toolPolicy: deriveToolPolicy(effectiveRoles),
  };
};