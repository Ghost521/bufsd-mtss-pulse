export type ScopeType = "org" | "district" | "school";

export type TenantContext = {
  organizationId: string;
  districtId?: string;
  schoolId?: string;
};

export type RoleKey = "org_admin" | "district_admin" | "principal" | "teacher" | "parent";

export type AppPermissionAction = "read" | "create" | "update" | "delete";
export type AppResource =
  | "students"
  | "student_profiles"
  | "staff"
  | "gradebook_assignments"
  | "gradebook_grades"
  | "documents"
  | "calendar"
  | "messages"
  | "interventions"
  | "referrals"
  | "lesson_plans"
  | "dashboard"
  | "reports"
  | "settings"
  | "imports"
  | "ai";

export type PermissionGrant = {
  resource: AppResource;
  action: AppPermissionAction;
  fields?: string[];
  effect?: "allow" | "deny";
};

export type MembershipRecord = {
  id: string;
  userId: string;
  role: RoleKey;
  scopeType: ScopeType;
  scopeId: string;
  groupIds: string[];
  status: "active" | "invited" | "disabled";
};

export type GroupRecord = {
  id: string;
  name: string;
  scopeType: ScopeType;
  scopeId: string;
  permissions: PermissionGrant[];
};

export type TenantUser = {
  id: string;
  name: string;
  email: string;
  primaryRole: RoleKey;
  linkedStudentIds?: string[];
};

export type OrganizationRecord = {
  id: string;
  name: string;
};

export type DistrictRecord = {
  id: string;
  organizationId: string;
  name: string;
};

export type SchoolRecord = {
  id: string;
  districtId: string;
  name: string;
};

export type InviteRecord = {
  id: string;
  email: string;
  role: RoleKey;
  scopeType: ScopeType;
  scopeId: string;
  invitedByUserId: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  updatedAt: string;
};

export type SessionContext = {
  user: TenantUser;
  memberships: MembershipRecord[];
  groups: GroupRecord[];
  activeContext: TenantContext;
  effectiveRoles: RoleKey[];
};
