import { readTenantCollection, writeTenantCollection } from "./persistence";
import type {
  DistrictRecord,
  GroupRecord,
  InviteRecord,
  MembershipRecord,
  OrganizationRecord,
  RoleKey,
  SchoolRecord,
  ScopeType,
  TenantContext,
  TenantUser,
} from "./tenant-types";

type TenantAuthDomain =
  | "tenant_organizations"
  | "tenant_districts"
  | "tenant_schools"
  | "tenant_users"
  | "tenant_memberships"
  | "tenant_groups"
  | "tenant_invites";

type TenantStoreState = {
  organizations: OrganizationRecord[];
  districts: DistrictRecord[];
  schools: SchoolRecord[];
  users: TenantUser[];
  memberships: MembershipRecord[];
  groups: GroupRecord[];
  invites: InviteRecord[];
};

export type WorkOSProvisionResult = {
  user: TenantUser | null;
  createdUser: boolean;
  createdMembership: boolean;
  reason?: string;
};

const TENANT_AUTH_STORE_KEY = process.env.TENANT_AUTH_STORE_KEY ?? "__tenant_auth__";
const WORKOS_PROVISION_AUTO_CREATE = (process.env.WORKOS_PROVISION_AUTO_CREATE ?? "true").toLowerCase() !== "false";
const WORKOS_PROVISION_DEFAULT_ROLE = process.env.WORKOS_PROVISION_DEFAULT_ROLE ?? "teacher";
const WORKOS_PROVISION_DEFAULT_SCOPE_TYPE = process.env.WORKOS_PROVISION_DEFAULT_SCOPE_TYPE ?? "school";
const WORKOS_PROVISION_DEFAULT_SCOPE_ID = process.env.WORKOS_PROVISION_DEFAULT_SCOPE_ID ?? "sch-ne";

const nowIso = (): string => new Date().toISOString();

const defaultOrganizations: OrganizationRecord[] = [
  { id: "org-bufsd", name: "BUFSD Organization" },
  { id: "org-riverside", name: "Riverside Education Group" },
];

const defaultDistricts: DistrictRecord[] = [
  { id: "dist-bufsd", organizationId: "org-bufsd", name: "Buffalo USD" },
  { id: "dist-lakeside", organizationId: "org-bufsd", name: "Lakeside Joint District" },
  { id: "dist-riverside", organizationId: "org-riverside", name: "Riverside School District" },
];

const defaultSchools: SchoolRecord[] = [
  { id: "sch-ne", districtId: "dist-bufsd", name: "Northeast Elementary" },
  { id: "sch-west", districtId: "dist-bufsd", name: "West Middle School" },
  { id: "sch-south", districtId: "dist-bufsd", name: "South High School" },
  { id: "sch-lake", districtId: "dist-lakeside", name: "Lakeview Middle School" },
  { id: "sch-river", districtId: "dist-riverside", name: "Riverside Elementary" },
];

const defaultUsers: TenantUser[] = [
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

const defaultMemberships: MembershipRecord[] = [
  { id: "m1", userId: "u-org-admin", role: "org_admin", scopeType: "org", scopeId: "org-bufsd", groupIds: [], status: "active" },
  { id: "m2", userId: "u-district-admin-bufsd", role: "district_admin", scopeType: "district", scopeId: "dist-bufsd", groupIds: [], status: "active" },
  { id: "m3", userId: "u-principal-ne", role: "principal", scopeType: "school", scopeId: "sch-ne", groupIds: ["g-reporting-ne"], status: "active" },
  { id: "m4", userId: "u-teacher-ne", role: "teacher", scopeType: "school", scopeId: "sch-ne", groupIds: [], status: "active" },
  { id: "m5", userId: "u-parent-leo", role: "parent", scopeType: "school", scopeId: "sch-ne", groupIds: [], status: "active" },
];

const defaultGroups: GroupRecord[] = [
  {
    id: "g-reporting-ne",
    name: "Northeast Reporting Delegates",
    scopeType: "school",
    scopeId: "sch-ne",
    permissions: [{ resource: "reports", action: "read" }, { resource: "settings", action: "read" }],
  },
];

const defaultInvites: InviteRecord[] = [];

const cloneOrganization = (value: OrganizationRecord): OrganizationRecord => ({ ...value });
const cloneDistrict = (value: DistrictRecord): DistrictRecord => ({ ...value });
const cloneSchool = (value: SchoolRecord): SchoolRecord => ({ ...value });
const cloneUser = (value: TenantUser): TenantUser => ({
  ...value,
  linkedStudentIds: value.linkedStudentIds ? [...value.linkedStudentIds] : undefined,
});
const cloneMembership = (value: MembershipRecord): MembershipRecord => ({ ...value, groupIds: [...value.groupIds] });
const cloneGroup = (value: GroupRecord): GroupRecord => ({
  ...value,
  permissions: value.permissions.map((permission) => ({
    ...permission,
    fields: permission.fields ? [...permission.fields] : undefined,
    effect: permission.effect,
  })),
});
const cloneInvite = (value: InviteRecord): InviteRecord => ({ ...value });

const cloneOrganizations = (rows: OrganizationRecord[]): OrganizationRecord[] => rows.map(cloneOrganization);
const cloneDistricts = (rows: DistrictRecord[]): DistrictRecord[] => rows.map(cloneDistrict);
const cloneSchools = (rows: SchoolRecord[]): SchoolRecord[] => rows.map(cloneSchool);
const cloneUsers = (rows: TenantUser[]): TenantUser[] => rows.map(cloneUser);
const cloneMemberships = (rows: MembershipRecord[]): MembershipRecord[] => rows.map(cloneMembership);
const cloneGroups = (rows: GroupRecord[]): GroupRecord[] => rows.map(cloneGroup);
const cloneInvites = (rows: InviteRecord[]): InviteRecord[] => rows.map(cloneInvite);

const seedState = (): TenantStoreState => ({
  organizations: cloneOrganizations(defaultOrganizations),
  districts: cloneDistricts(defaultDistricts),
  schools: cloneSchools(defaultSchools),
  users: cloneUsers(defaultUsers),
  memberships: cloneMemberships(defaultMemberships),
  groups: cloneGroups(defaultGroups),
  invites: cloneInvites(defaultInvites),
});

let tenantStoreState: TenantStoreState = seedState();
let isHydrated = false;
let hydrationPromise: Promise<void> | null = null;
const workosProvisionLocks = new Map<string, Promise<WorkOSProvisionResult>>();

const readDomain = async <T>(domain: TenantAuthDomain, seedFactory: () => T[]): Promise<T[]> =>
  readTenantCollection<T>(TENANT_AUTH_STORE_KEY, domain, seedFactory);

const hydrateState = async (): Promise<void> => {
  const [organizations, districts, schools, users, memberships, groups, invites] = await Promise.all([
    readDomain("tenant_organizations", () => cloneOrganizations(defaultOrganizations)),
    readDomain("tenant_districts", () => cloneDistricts(defaultDistricts)),
    readDomain("tenant_schools", () => cloneSchools(defaultSchools)),
    readDomain("tenant_users", () => cloneUsers(defaultUsers)),
    readDomain("tenant_memberships", () => cloneMemberships(defaultMemberships)),
    readDomain("tenant_groups", () => cloneGroups(defaultGroups)),
    readDomain("tenant_invites", () => cloneInvites(defaultInvites)),
  ]);

  tenantStoreState = {
    organizations: cloneOrganizations(organizations as OrganizationRecord[]),
    districts: cloneDistricts(districts as DistrictRecord[]),
    schools: cloneSchools(schools as SchoolRecord[]),
    users: cloneUsers(users as TenantUser[]),
    memberships: cloneMemberships(memberships as MembershipRecord[]),
    groups: cloneGroups(groups as GroupRecord[]),
    invites: cloneInvites(invites as InviteRecord[]),
  };
  isHydrated = true;
};

export const ensureTenantStoreHydrated = async (): Promise<void> => {
  if (isHydrated) return;
  if (!hydrationPromise) {
    hydrationPromise = hydrateState().finally(() => {
      hydrationPromise = null;
    });
  }
  await hydrationPromise;
};

const persistDomain = async <T>(domain: TenantAuthDomain, rows: T[]): Promise<void> => {
  await writeTenantCollection(TENANT_AUTH_STORE_KEY, domain, rows);
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const isRoleKey = (value: string): value is RoleKey =>
  value === "org_admin" ||
  value === "district_admin" ||
  value === "principal" ||
  value === "school_admin" ||
  value === "teacher" ||
  value === "parent";

const isScopeType = (value: string): value is ScopeType => value === "org" || value === "district" || value === "school";

const scopeExists = (scopeType: ScopeType, scopeId: string): boolean => {
  if (scopeType === "org") return tenantStoreState.organizations.some((item) => item.id === scopeId);
  if (scopeType === "district") return tenantStoreState.districts.some((item) => item.id === scopeId);
  return tenantStoreState.schools.some((item) => item.id === scopeId);
};

const fallbackScopeId = (scopeType: ScopeType): string | null => {
  if (scopeType === "org") return tenantStoreState.organizations[0]?.id ?? null;
  if (scopeType === "district") return tenantStoreState.districts[0]?.id ?? null;
  return tenantStoreState.schools[0]?.id ?? null;
};

const resolveProvisionScope = (
  role: string,
  scopeType: string,
  scopeId: string
): { role: RoleKey; scopeType: ScopeType; scopeId: string } | null => {
  const normalizedRole: RoleKey = isRoleKey(role) ? role : "teacher";
  const normalizedScopeType: ScopeType = isScopeType(scopeType) ? scopeType : "school";
  if (scopeExists(normalizedScopeType, scopeId)) {
    return {
      role: normalizedRole,
      scopeType: normalizedScopeType,
      scopeId,
    };
  }

  const fallback = fallbackScopeId(normalizedScopeType);
  if (!fallback) return null;
  return {
    role: normalizedRole,
    scopeType: normalizedScopeType,
    scopeId: fallback,
  };
};

const makeWorkOSUserId = (email: string): string => {
  const base = email
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const prefix = base.length > 0 ? base : "user";
  let candidate = `u-wos-${prefix}`;
  if (!tenantStoreState.users.some((item) => item.id === candidate)) return candidate;

  let index = 2;
  while (tenantStoreState.users.some((item) => item.id === `${candidate}-${index}`)) {
    index += 1;
  }
  return `${candidate}-${index}`;
};

const makeMembershipId = (): string => `m-wos-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const makeInviteId = (): string => `inv-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const nameFromEmail = (email: string): string => {
  const localPart = normalizeEmail(email).split("@")[0] ?? "user";
  return localPart
    .split(/[._-]+/)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(" ");
};

const getPendingInviteForEmail = (email: string): InviteRecord | null => {
  const normalized = normalizeEmail(email);
  return tenantStoreState.invites.find((invite) => invite.status === "pending" && normalizeEmail(invite.email) === normalized) ?? null;
};

const getDistrictForSchool = (schoolId: string): DistrictRecord | null => {
  const school = tenantStoreState.schools.find((item) => item.id === schoolId);
  if (!school) return null;
  return tenantStoreState.districts.find((district) => district.id === school.districtId) ?? null;
};

const getOrganizationForDistrict = (districtId: string): OrganizationRecord | null => {
  const district = tenantStoreState.districts.find((item) => item.id === districtId);
  if (!district) return null;
  return tenantStoreState.organizations.find((organization) => organization.id === district.organizationId) ?? null;
};

export const isWorkOSAutoProvisionEnabled = (): boolean => WORKOS_PROVISION_AUTO_CREATE;

export const getOrganizations = (): OrganizationRecord[] => cloneOrganizations(tenantStoreState.organizations);
export const getDistricts = (): DistrictRecord[] => cloneDistricts(tenantStoreState.districts);
export const getSchools = (): SchoolRecord[] => cloneSchools(tenantStoreState.schools);
export const getUsers = (): TenantUser[] => cloneUsers(tenantStoreState.users);
export const getMemberships = (): MembershipRecord[] => cloneMemberships(tenantStoreState.memberships);
export const getGroups = (): GroupRecord[] => cloneGroups(tenantStoreState.groups);
export const getInvites = (): InviteRecord[] => cloneInvites(tenantStoreState.invites);

export const findUserById = (userId: string): TenantUser | null =>
  (() => {
    const found = tenantStoreState.users.find((user) => user.id === userId);
    return found ? cloneUser(found) : null;
  })();

export const findUserByEmail = (email: string): TenantUser | null => {
  const normalized = normalizeEmail(email);
  const found = tenantStoreState.users.find((user) => normalizeEmail(user.email) === normalized);
  return found ? cloneUser(found) : null;
};

export const getUserMemberships = (userId: string): MembershipRecord[] =>
  tenantStoreState.memberships.filter((membership) => membership.userId === userId && membership.status === "active").map(cloneMembership);

export const getUserGroups = (membershipList: MembershipRecord[]): GroupRecord[] => {
  const groupIds = new Set<string>();
  for (const membership of membershipList) {
    membership.groupIds.forEach((groupId) => groupIds.add(groupId));
  }
  return tenantStoreState.groups.filter((group) => groupIds.has(group.id)).map(cloneGroup);
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
  const organization = tenantStoreState.organizations.find((item) => item.id === context.organizationId);
  if (!organization) return null;

  if (!context.districtId) {
    return { organizationId: context.organizationId };
  }

  const district = tenantStoreState.districts.find((item) => item.id === context.districtId && item.organizationId === context.organizationId);
  if (!district) return null;

  if (!context.schoolId) {
    return { organizationId: context.organizationId, districtId: context.districtId };
  }

  const school = tenantStoreState.schools.find((item) => item.id === context.schoolId && item.districtId === context.districtId);
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
      const organization = tenantStoreState.organizations.find((item) => item.id === membership.scopeId);
      if (!organization) continue;
      addContext({ organizationId: organization.id });
      const childDistricts = tenantStoreState.districts.filter((district) => district.organizationId === organization.id);
      for (const district of childDistricts) {
        addContext({ organizationId: organization.id, districtId: district.id });
        const childSchools = tenantStoreState.schools.filter((school) => school.districtId === district.id);
        childSchools.forEach((school) =>
          addContext({ organizationId: organization.id, districtId: district.id, schoolId: school.id })
        );
      }
      continue;
    }

    if (membership.scopeType === "district") {
      const district = tenantStoreState.districts.find((item) => item.id === membership.scopeId);
      if (!district) continue;
      addContext({ organizationId: district.organizationId, districtId: district.id });
      const childSchools = tenantStoreState.schools.filter((school) => school.districtId === district.id);
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

export const createInvite = async (input: {
  email: string;
  role: RoleKey;
  scopeType: "org" | "district" | "school";
  scopeId: string;
  invitedByUserId: string;
}): Promise<InviteRecord> => {
  await ensureTenantStoreHydrated();
  const invite: InviteRecord = {
    id: makeInviteId(),
    email: normalizeEmail(input.email),
    role: input.role,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    invitedByUserId: input.invitedByUserId,
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  tenantStoreState.invites = [invite, ...tenantStoreState.invites];
  await persistDomain("tenant_invites", tenantStoreState.invites);
  return cloneInvite(invite);
};

export const updateInviteStatus = async (inviteId: string, status: InviteRecord["status"]): Promise<InviteRecord | null> => {
  await ensureTenantStoreHydrated();
  const index = tenantStoreState.invites.findIndex((item) => item.id === inviteId);
  if (index < 0) return null;
  const updated: InviteRecord = {
    ...tenantStoreState.invites[index],
    status,
    updatedAt: nowIso(),
  };
  tenantStoreState.invites = [...tenantStoreState.invites];
  tenantStoreState.invites[index] = updated;
  await persistDomain("tenant_invites", tenantStoreState.invites);
  return cloneInvite(updated);
};

const upsertMembershipForUser = async (input: {
  userId: string;
  role: RoleKey;
  scopeType: ScopeType;
  scopeId: string;
}): Promise<boolean> => {
  const existing = tenantStoreState.memberships.find(
    (membership) =>
      membership.userId === input.userId &&
      membership.role === input.role &&
      membership.scopeType === input.scopeType &&
      membership.scopeId === input.scopeId &&
      membership.status === "active"
  );
  if (existing) return false;

  const membership: MembershipRecord = {
    id: makeMembershipId(),
    userId: input.userId,
    role: input.role,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    groupIds: [],
    status: "active",
  };
  tenantStoreState.memberships = [membership, ...tenantStoreState.memberships];
  await persistDomain("tenant_memberships", tenantStoreState.memberships);
  return true;
};

export const provisionUserFromWorkOSEmail = async (input: {
  email: string;
  name?: string | null;
}): Promise<WorkOSProvisionResult> => {
  const normalizedEmail = normalizeEmail(input.email);
  const inFlight = workosProvisionLocks.get(normalizedEmail);
  if (inFlight) return inFlight;

  const task = (async (): Promise<WorkOSProvisionResult> => {
    await ensureTenantStoreHydrated();
    const existingUser = findUserByEmail(normalizedEmail);
    const pendingInvite = getPendingInviteForEmail(normalizedEmail);

    const inviteScope = pendingInvite
      ? resolveProvisionScope(pendingInvite.role, pendingInvite.scopeType, pendingInvite.scopeId)
      : null;
    const defaultScope = resolveProvisionScope(
      WORKOS_PROVISION_DEFAULT_ROLE,
      WORKOS_PROVISION_DEFAULT_SCOPE_TYPE,
      WORKOS_PROVISION_DEFAULT_SCOPE_ID
    );
    const selectedScope = inviteScope ?? defaultScope;

    if (existingUser) {
      const existingMemberships = getUserMemberships(existingUser.id);
      let createdMembership = false;
      if (existingMemberships.length === 0) {
        if (!WORKOS_PROVISION_AUTO_CREATE) {
          return {
            user: cloneUser(existingUser),
            createdUser: false,
            createdMembership: false,
            reason: "Existing user has no memberships and auto-provisioning is disabled.",
          };
        }
        if (!selectedScope) {
          return {
            user: cloneUser(existingUser),
            createdUser: false,
            createdMembership: false,
            reason: "Unable to resolve a valid default membership scope for provisioning.",
          };
        }
        createdMembership = await upsertMembershipForUser({
          userId: existingUser.id,
          role: selectedScope.role,
          scopeType: selectedScope.scopeType,
          scopeId: selectedScope.scopeId,
        });
      }

      if (pendingInvite && pendingInvite.status === "pending") {
        await updateInviteStatus(pendingInvite.id, "accepted");
      }

      return {
        user: cloneUser(existingUser),
        createdUser: false,
        createdMembership,
      };
    }

    if (!WORKOS_PROVISION_AUTO_CREATE) {
      return {
        user: null,
        createdUser: false,
        createdMembership: false,
        reason: "Auto-provisioning is disabled and no local tenant user mapping exists.",
      };
    }

    if (!selectedScope) {
      return {
        user: null,
        createdUser: false,
        createdMembership: false,
        reason: "Unable to resolve a valid default scope for auto-provisioning.",
      };
    }

    const nextUser: TenantUser = {
      id: makeWorkOSUserId(normalizedEmail),
      name: (input.name?.trim() || nameFromEmail(normalizedEmail)).trim(),
      email: normalizedEmail,
      primaryRole: selectedScope.role,
    };
    tenantStoreState.users = [nextUser, ...tenantStoreState.users];
    await persistDomain("tenant_users", tenantStoreState.users);

    const createdMembership = await upsertMembershipForUser({
      userId: nextUser.id,
      role: selectedScope.role,
      scopeType: selectedScope.scopeType,
      scopeId: selectedScope.scopeId,
    });

    if (pendingInvite && pendingInvite.status === "pending") {
      await updateInviteStatus(pendingInvite.id, "accepted");
    }

    return {
      user: cloneUser(nextUser),
      createdUser: true,
      createdMembership,
    };
  })();

  workosProvisionLocks.set(normalizedEmail, task);
  return task.finally(() => {
    workosProvisionLocks.delete(normalizedEmail);
  });
};
