import type {
  DistrictRecord,
  GroupRecord,
  InviteRecord,
  MembershipRecord,
  OrganizationRecord,
  RoleKey,
  SchoolRecord,
  TenantContext,
  TenantUser,
} from "./tenant-types";

const nowIso = (): string => new Date().toISOString();

const organizations: OrganizationRecord[] = [
  { id: "org-bufsd", name: "BUFSD Organization" },
  { id: "org-riverside", name: "Riverside Education Group" },
];

const districts: DistrictRecord[] = [
  { id: "dist-bufsd", organizationId: "org-bufsd", name: "Buffalo USD" },
  { id: "dist-lakeside", organizationId: "org-bufsd", name: "Lakeside Joint District" },
  { id: "dist-riverside", organizationId: "org-riverside", name: "Riverside School District" },
];

const schools: SchoolRecord[] = [
  { id: "sch-ne", districtId: "dist-bufsd", name: "Northeast Elementary" },
  { id: "sch-west", districtId: "dist-bufsd", name: "West Middle School" },
  { id: "sch-south", districtId: "dist-bufsd", name: "South High School" },
  { id: "sch-lake", districtId: "dist-lakeside", name: "Lakeview Middle School" },
  { id: "sch-river", districtId: "dist-riverside", name: "Riverside Elementary" },
];

const users: TenantUser[] = [
  {
    id: "u-org-admin",
    name: "Avery Admin",
    email: "avery.admin@example.org",
    primaryRole: "org_admin",
  },
  {
    id: "u-district-admin-bufsd",
    name: "Dr. Aris Thorne",
    email: "aris.thorne@bufsd.org",
    primaryRole: "district_admin",
  },
  {
    id: "u-principal-ne",
    name: "Rosa Cortese",
    email: "rosa.cortese@bufsd.org",
    primaryRole: "principal",
  },
  {
    id: "u-teacher-ne",
    name: "Mr. Davis",
    email: "mr.davis@bufsd.org",
    primaryRole: "teacher",
  },
  {
    id: "u-parent-leo",
    name: "Mrs. Martinez",
    email: "mrs.martinez@example.com",
    primaryRole: "parent",
    linkedStudentIds: ["STU-LEO-1"],
  },
];

const memberships: MembershipRecord[] = [
  { id: "m1", userId: "u-org-admin", role: "org_admin", scopeType: "org", scopeId: "org-bufsd", groupIds: [], status: "active" },
  { id: "m2", userId: "u-district-admin-bufsd", role: "district_admin", scopeType: "district", scopeId: "dist-bufsd", groupIds: [], status: "active" },
  { id: "m3", userId: "u-principal-ne", role: "principal", scopeType: "school", scopeId: "sch-ne", groupIds: ["g-reporting-ne"], status: "active" },
  { id: "m4", userId: "u-teacher-ne", role: "teacher", scopeType: "school", scopeId: "sch-ne", groupIds: [], status: "active" },
  { id: "m5", userId: "u-parent-leo", role: "parent", scopeType: "school", scopeId: "sch-ne", groupIds: [], status: "active" },
];

const groups: GroupRecord[] = [
  {
    id: "g-reporting-ne",
    name: "Northeast Reporting Delegates",
    scopeType: "school",
    scopeId: "sch-ne",
    permissions: [{ resource: "reports", action: "read" }, { resource: "settings", action: "read" }],
  },
];

const invites: InviteRecord[] = [];

export const getOrganizations = (): OrganizationRecord[] => organizations.map((item) => ({ ...item }));
export const getDistricts = (): DistrictRecord[] => districts.map((item) => ({ ...item }));
export const getSchools = (): SchoolRecord[] => schools.map((item) => ({ ...item }));
export const getUsers = (): TenantUser[] => users.map((item) => ({ ...item, linkedStudentIds: item.linkedStudentIds ? [...item.linkedStudentIds] : undefined }));
export const getMemberships = (): MembershipRecord[] => memberships.map((item) => ({ ...item, groupIds: [...item.groupIds] }));
export const getGroups = (): GroupRecord[] => groups.map((item) => ({ ...item, permissions: item.permissions.map((permission) => ({ ...permission, fields: permission.fields ? [...permission.fields] : undefined })) }));
export const getInvites = (): InviteRecord[] => invites.map((item) => ({ ...item }));

export const findUserById = (userId: string): TenantUser | null => getUsers().find((user) => user.id === userId) ?? null;
export const findUserByEmail = (email: string): TenantUser | null => {
  const normalized = email.trim().toLowerCase();
  return getUsers().find((user) => user.email.trim().toLowerCase() === normalized) ?? null;
};

export const getUserMemberships = (userId: string): MembershipRecord[] =>
  getMemberships().filter((membership) => membership.userId === userId && membership.status === "active");

export const getUserGroups = (membershipList: MembershipRecord[]): GroupRecord[] => {
  const groupIds = new Set<string>();
  for (const membership of membershipList) {
    membership.groupIds.forEach((groupId) => groupIds.add(groupId));
  }
  return getGroups().filter((group) => groupIds.has(group.id));
};

const getDistrictForSchool = (schoolId: string): DistrictRecord | null => {
  const school = districts.length ? getSchools().find((item) => item.id === schoolId) : null;
  if (!school) return null;
  return getDistricts().find((district) => district.id === school.districtId) ?? null;
};

const getOrganizationForDistrict = (districtId: string): OrganizationRecord | null => {
  const district = getDistricts().find((item) => item.id === districtId);
  if (!district) return null;
  return getOrganizations().find((organization) => organization.id === district.organizationId) ?? null;
};

export const buildDefaultContextForMembership = (membership: MembershipRecord): TenantContext | null => {
  if (membership.scopeType === "org") {
    return { organizationId: membership.scopeId };
  }

  if (membership.scopeType === "district") {
    const organization = getOrganizationForDistrict(membership.scopeId);
    if (!organization) return null;
    return { organizationId: organization.id, districtId: membership.scopeId };
  }

  if (membership.scopeType === "school") {
    const district = getDistrictForSchool(membership.scopeId);
    if (!district) return null;
    return { organizationId: district.organizationId, districtId: district.id, schoolId: membership.scopeId };
  }

  return null;
};

export const normalizeContext = (context: TenantContext): TenantContext | null => {
  const organization = getOrganizations().find((item) => item.id === context.organizationId);
  if (!organization) return null;

  if (!context.districtId) {
    return { organizationId: context.organizationId };
  }

  const district = getDistricts().find((item) => item.id === context.districtId && item.organizationId === context.organizationId);
  if (!district) return null;

  if (!context.schoolId) {
    return { organizationId: context.organizationId, districtId: context.districtId };
  }

  const school = getSchools().find((item) => item.id === context.schoolId && item.districtId === context.districtId);
  if (!school) return null;

  return {
    organizationId: context.organizationId,
    districtId: context.districtId,
    schoolId: context.schoolId,
  };
};

const contextMatchesMembership = (context: TenantContext, membership: MembershipRecord): boolean => {
  if (membership.scopeType === "org") return membership.scopeId === context.organizationId;
  if (membership.scopeType === "district") return membership.scopeId === context.districtId;
  if (membership.scopeType === "school") return membership.scopeId === context.schoolId;
  return false;
};

export const canUserAccessContext = (context: TenantContext, membershipList: MembershipRecord[]): boolean =>
  membershipList.some((membership) => contextMatchesMembership(context, membership));

export const getAccessibleContextsForMemberships = (membershipList: MembershipRecord[]): TenantContext[] => {
  const dedup = new Map<string, TenantContext>();
  for (const membership of membershipList) {
    const addContext = (context: TenantContext) => {
      const key = `${context.organizationId}:${context.districtId ?? ""}:${context.schoolId ?? ""}`;
      dedup.set(key, context);
    };

    if (membership.scopeType === "org") {
      const organization = getOrganizations().find((item) => item.id === membership.scopeId);
      if (!organization) continue;
      addContext({ organizationId: organization.id });
      const childDistricts = getDistricts().filter((district) => district.organizationId === organization.id);
      for (const district of childDistricts) {
        addContext({ organizationId: organization.id, districtId: district.id });
        const childSchools = getSchools().filter((school) => school.districtId === district.id);
        childSchools.forEach((school) =>
          addContext({ organizationId: organization.id, districtId: district.id, schoolId: school.id })
        );
      }
      continue;
    }

    if (membership.scopeType === "district") {
      const district = getDistricts().find((item) => item.id === membership.scopeId);
      if (!district) continue;
      addContext({ organizationId: district.organizationId, districtId: district.id });
      const childSchools = getSchools().filter((school) => school.districtId === district.id);
      childSchools.forEach((school) =>
        addContext({ organizationId: district.organizationId, districtId: district.id, schoolId: school.id })
      );
      continue;
    }

    const context = buildDefaultContextForMembership(membership);
    if (!context) continue;
    addContext(context);
  }
  return [...dedup.values()];
};

export const createInvite = (input: {
  email: string;
  role: RoleKey;
  scopeType: "org" | "district" | "school";
  scopeId: string;
  invitedByUserId: string;
}): InviteRecord => {
  const invite: InviteRecord = {
    id: `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    invitedByUserId: input.invitedByUserId,
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  invites.unshift(invite);
  return { ...invite };
};

export const updateInviteStatus = (inviteId: string, status: InviteRecord["status"]): InviteRecord | null => {
  const invite = invites.find((item) => item.id === inviteId);
  if (!invite) return null;
  invite.status = status;
  invite.updatedAt = nowIso();
  return { ...invite };
};
