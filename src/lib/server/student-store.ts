import { CLASS_ROSTER_DATA, generateMasterRoster } from "../../constants";
import { Tier } from "../../types";
import {
  tenantStudentCollectionSchema,
  tenantStudentRecordSchema,
  type CreateStudentInput,
  type TenantStudentRecord,
  type UpdateStudentInput,
} from "../schemas/students";
import {
  deleteStudentRowByTenant,
  listStudentRowsByTenant,
  readTenantCollection,
  replaceStudentRowsByTenant,
  toTenantKey,
  upsertStudentRowByTenant,
  writeTenantCollection,
  type StudentRowScope,
} from "./persistence";
import { getDistricts, getMemberships, getSchools, findUserById } from "./tenant-store";
import type { TenantContext } from "./tenant-types";

export type StudentScope = "master" | "class";
export type { CreateStudentInput, UpdateStudentInput, TenantStudentRecord };

type StudentListOptions = {
  scope: StudentScope;
  context: TenantContext;
  requesterUserId: string;
  requesterRoles: string[];
  includeArchived?: boolean;
  filters?: StudentListFilters;
};

export type StudentListFilters = {
  schoolId?: string;
  principalUserId?: string;
  grade?: string;
  teacherUserId?: string;
  teacherName?: string;
};

const STUDENTS_MASTER_DOMAIN = "students_master";
const STUDENTS_CLASS_DOMAIN = "students_class";
const STUDENTS_MASTER_SCOPE: StudentRowScope = "master";
const STUDENTS_CLASS_SCOPE: StudentRowScope = "class";

const getDistrictById = (districtId: string) => getDistricts().find((district) => district.id === districtId) ?? null;
const getSchoolById = (schoolId: string) => getSchools().find((school) => school.id === schoolId) ?? null;

const tierScore = (tier: Tier): number => {
  switch (tier) {
    case Tier.TIER_3:
      return 3;
    case Tier.TIER_2:
      return 2;
    case Tier.TIER_1:
    default:
      return 1;
  }
};

const sortMasterRoster = (rows: TenantStudentRecord[]): TenantStudentRecord[] =>
  [...rows].sort((a, b) => {
    const tierDiff = tierScore(b.tier) - tierScore(a.tier);
    if (tierDiff !== 0) return tierDiff;
    return a.name.localeCompare(b.name);
  });

const cloneStudent = (student: TenantStudentRecord): TenantStudentRecord => ({ ...student, guardianUserIds: [...student.guardianUserIds] });
const cloneStudents = (rows: TenantStudentRecord[]): TenantStudentRecord[] => rows.map(cloneStudent);

const extractNumericId = (id: string): number => {
  const matched = id.match(/(\d+)$/);
  return matched ? Number(matched[1]) : 0;
};

const toAvatarSeed = (name: string): string => name.trim().replace(/\s+/g, "-").toLowerCase();

const deriveLifecycleStatus = (student: Pick<TenantStudentRecord, "activeInterventions">): TenantStudentRecord["status"] =>
  student.activeInterventions > 0 ? "active" : "monitoring";

const parseStoredRows = (rows: unknown): TenantStudentRecord[] => {
  const parsed = tenantStudentCollectionSchema.safeParse(rows);
  if (parsed.success) {
    return parsed.data.map((student) => ({
      ...student,
      status: student.status ?? deriveLifecycleStatus(student),
      isArchived: student.isArchived ?? false,
    }));
  }

  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => tenantStudentRecordSchema.safeParse(row))
    .filter((candidate): candidate is { success: true; data: TenantStudentRecord } => candidate.success)
    .map((candidate) => ({
      ...candidate.data,
      status: candidate.data.status ?? deriveLifecycleStatus(candidate.data),
      isArchived: candidate.data.isArchived ?? false,
    }));
};

const resolveTeacherName = (student: TenantStudentRecord): string => {
  if (student.teacherName && student.teacherName.trim().length > 0) return student.teacherName;
  if (!student.teacherUserId) return "Unassigned";
  const user = findUserById(student.teacherUserId);
  return user?.name?.trim() || "Unassigned";
};

const toCanonicalStudent = (student: TenantStudentRecord): TenantStudentRecord => {
  const teacherName = resolveTeacherName(student);
  return {
    ...student,
    teacherName,
    teacher: teacherName,
    status: student.status ?? deriveLifecycleStatus(student),
    isArchived: student.isArchived ?? false,
  };
};

const assignTenantMetadata = (
  student: Omit<TenantStudentRecord, "organizationId" | "districtId" | "schoolId" | "teacherUserId" | "guardianUserIds" | "teacherName" | "status" | "isArchived">,
  schoolId: string
): TenantStudentRecord | null => {
  const school = getSchoolById(schoolId);
  if (!school) return null;
  const district = getDistrictById(school.districtId);
  if (!district) return null;

  return {
    ...student,
    organizationId: district.organizationId,
    districtId: district.id,
    schoolId,
    teacherUserId: schoolId === "sch-ne" ? "u-teacher-ne" : undefined,
    teacherName: schoolId === "sch-ne" ? "Mr. Davis" : undefined,
    status: deriveLifecycleStatus(student),
    isArchived: false,
    guardianUserIds: student.id === "STU-LEO-1" ? ["u-parent-leo"] : [],
  };
};

const seedMasterRoster = (): TenantStudentRecord[] => {
  const schoolSequence = ["sch-ne", "sch-west", "sch-south", "sch-lake", "sch-river"];
  const generated = generateMasterRoster();

  const seeded = generated
    .map((student, index) => {
      const schoolId = schoolSequence[index % schoolSequence.length];
      const withTenant = assignTenantMetadata(student, schoolId);
      return withTenant;
    })
    .filter((student): student is TenantStudentRecord => Boolean(student));

  const leo = seeded[0];
  if (leo) {
    leo.id = "STU-LEO-1";
    leo.name = "Leo Martinez";
    leo.schoolId = "sch-ne";
    leo.districtId = "dist-bufsd";
    leo.organizationId = "org-bufsd";
    leo.guardianUserIds = ["u-parent-leo"];
    leo.teacherUserId = "u-teacher-ne";
    leo.teacherName = "Mr. Davis";
    leo.status = deriveLifecycleStatus(leo);
    leo.avatarSeed = toAvatarSeed(leo.name);
  }

  return sortMasterRoster(seeded);
};

const seedClassRoster = (): TenantStudentRecord[] =>
  CLASS_ROSTER_DATA.map((student, index) => {
    const id = index === 0 ? "STU-LEO-1" : student.id;
    return {
      ...student,
      id,
      organizationId: "org-bufsd",
      districtId: "dist-bufsd",
      schoolId: "sch-ne",
      teacherUserId: "u-teacher-ne",
      teacherName: student.teacherName ?? student.teacher ?? "Mr. Davis",
      status: student.status ?? deriveLifecycleStatus(student),
      isArchived: student.isArchived ?? false,
      guardianUserIds: id === "STU-LEO-1" ? ["u-parent-leo"] : [],
      avatarSeed: toAvatarSeed(student.name),
    };
  });

const parseStoredStudentRows = (rows: unknown): TenantStudentRecord[] => parseStoredRows(rows).map(toCanonicalStudent);

const readStudentScopeRows = async (
  context: TenantContext,
  scope: StudentRowScope,
  legacyDomain: typeof STUDENTS_MASTER_DOMAIN | typeof STUDENTS_CLASS_DOMAIN,
  seedFactory: () => TenantStudentRecord[]
): Promise<TenantStudentRecord[]> => {
  const tenantKey = toTenantKey(context);
  const rowLevelRows = parseStoredStudentRows(await listStudentRowsByTenant<unknown>(tenantKey, scope));
  if (rowLevelRows.length > 0) {
    return scope === STUDENTS_MASTER_SCOPE ? sortMasterRoster(rowLevelRows) : rowLevelRows;
  }

  const legacyRows = await readTenantCollection<unknown>(tenantKey, legacyDomain, seedFactory);
  const parsedLegacyRows = parseStoredStudentRows(legacyRows);
  if (parsedLegacyRows.length > 0) {
    await replaceStudentRowsByTenant(tenantKey, scope, parsedLegacyRows);
  }
  return scope === STUDENTS_MASTER_SCOPE ? sortMasterRoster(parsedLegacyRows) : parsedLegacyRows;
};

const readMasterRoster = async (context: TenantContext): Promise<TenantStudentRecord[]> =>
  readStudentScopeRows(context, STUDENTS_MASTER_SCOPE, STUDENTS_MASTER_DOMAIN, seedMasterRoster);

const readClassRoster = async (context: TenantContext): Promise<TenantStudentRecord[]> => {
  return readStudentScopeRows(context, STUDENTS_CLASS_SCOPE, STUDENTS_CLASS_DOMAIN, seedClassRoster);
};

const replaceMasterRoster = async (context: TenantContext, rows: TenantStudentRecord[]): Promise<void> => {
  const tenantKey = toTenantKey(context);
  const validRows = tenantStudentCollectionSchema.parse(sortMasterRoster(rows)).map(toCanonicalStudent);
  await replaceStudentRowsByTenant(tenantKey, STUDENTS_MASTER_SCOPE, validRows);
};

const makeMasterId = (rows: TenantStudentRecord[]): string => {
  const nextId = rows.reduce((max, item) => Math.max(max, extractNumericId(item.id)), 1000) + 1;
  return `STU-M-${nextId}`;
};

const contextContainsStudent = (context: TenantContext, student: TenantStudentRecord): boolean => {
  if (student.organizationId !== context.organizationId) return false;
  if (context.districtId && student.districtId !== context.districtId) return false;
  if (context.schoolId && student.schoolId !== context.schoolId) return false;
  return true;
};

const hasAnyRole = (roles: string[], expected: string[]): boolean => expected.some((role) => roles.includes(role));

const filterByRole = (
  rows: TenantStudentRecord[],
  requesterUserId: string,
  requesterRoles: string[]
): TenantStudentRecord[] => {
  if (hasAnyRole(requesterRoles, ["org_admin", "district_admin", "principal", "school_admin"])) return rows;
  if (requesterRoles.includes("teacher")) return rows.filter((student) => student.teacherUserId === requesterUserId);
  if (requesterRoles.includes("parent")) return rows.filter((student) => student.guardianUserIds.includes(requesterUserId));
  return [];
};

const normalizeFilterValue = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parsePrincipalPlaceholderSchool = (principalUserId: string): string | null => {
  if (!principalUserId.startsWith("none:")) return null;
  const schoolId = principalUserId.slice("none:".length).trim();
  return schoolId.length > 0 ? schoolId : null;
};

const getPrincipalSchoolIds = (principalUserId: string): Set<string> => {
  const memberships = getMemberships().filter(
    (membership) =>
      membership.userId === principalUserId &&
      membership.status === "active" &&
      membership.scopeType === "school" &&
      (membership.role === "principal" || membership.role === "school_admin")
  );
  return new Set(memberships.map((membership) => membership.scopeId));
};

const filterByRequestedNodes = (
  rows: TenantStudentRecord[],
  filters?: StudentListFilters
): TenantStudentRecord[] => {
  if (!filters) return rows;

  const schoolId = normalizeFilterValue(filters.schoolId);
  const principalUserId = normalizeFilterValue(filters.principalUserId);
  const grade = normalizeFilterValue(filters.grade);
  const teacherUserId = normalizeFilterValue(filters.teacherUserId);
  const teacherName = normalizeFilterValue(filters.teacherName);

  let next = rows;
  if (schoolId) {
    next = next.filter((student) => student.schoolId === schoolId);
  }

  if (principalUserId) {
    const placeholderSchoolId = parsePrincipalPlaceholderSchool(principalUserId);
    if (placeholderSchoolId) {
      next = next.filter((student) => student.schoolId === placeholderSchoolId);
    } else {
      const schoolIds = getPrincipalSchoolIds(principalUserId);
      if (schoolIds.size === 0) return [];
      next = next.filter((student) => schoolIds.has(student.schoolId));
    }
  }

  if (grade) {
    const normalizedGrade = grade.toLowerCase();
    next = next.filter((student) => student.grade.trim().toLowerCase() === normalizedGrade);
  }
  if (teacherUserId) next = next.filter((student) => student.teacherUserId === teacherUserId);
  if (teacherName) {
    const normalizedTeacher = teacherName.toLowerCase();
    next = next.filter((student) => resolveTeacherName(student).toLowerCase() === normalizedTeacher);
  }
  return next;
};

const resolveTargetSchoolForCreate = (context: TenantContext, explicitSchoolId?: string): string | null => {
  if (explicitSchoolId) {
    const school = getSchoolById(explicitSchoolId);
    if (!school) return null;
    if (context.districtId && school.districtId !== context.districtId) return null;
    const district = getDistrictById(school.districtId);
    if (!district || district.organizationId !== context.organizationId) return null;
    return school.id;
  }

  if (context.schoolId) return context.schoolId;

  if (context.districtId) {
    const districtSchool = getSchools().find((school) => school.districtId === context.districtId);
    return districtSchool?.id ?? null;
  }

  const orgDistrict = getDistricts().find((district) => district.organizationId === context.organizationId);
  if (!orgDistrict) return null;
  const school = getSchools().find((item) => item.districtId === orgDistrict.id);
  return school?.id ?? null;
};

export const listStudents = async (options: StudentListOptions): Promise<TenantStudentRecord[]> => {
  const baseStore = options.scope === "master" ? await readMasterRoster(options.context) : await readClassRoster(options.context);
  const scoped = baseStore.filter((student) => contextContainsStudent(options.context, student));
  const roleScoped = filterByRole(scoped, options.requesterUserId, options.requesterRoles);
  const requestedScope = filterByRequestedNodes(roleScoped, options.filters);
  const activeOnly = options.includeArchived ? requestedScope : requestedScope.filter((student) => !student.isArchived);
  return cloneStudents(activeOnly.map(toCanonicalStudent));
};

export const getStudentById = async (studentId: string, context: TenantContext): Promise<TenantStudentRecord | null> => {
  const [masterRows, classRows] = await Promise.all([readMasterRoster(context), readClassRoster(context)]);
  const found = masterRows.find((student) => student.id === studentId) ?? classRows.find((student) => student.id === studentId);
  return found ? cloneStudent(toCanonicalStudent(found)) : null;
};

export const createMasterStudent = async (
  input: CreateStudentInput,
  context: TenantContext,
  actorUserId: string
): Promise<TenantStudentRecord | null> => {
  const targetSchoolId = resolveTargetSchoolForCreate(context, input.schoolId);
  if (!targetSchoolId) return null;
  const school = getSchoolById(targetSchoolId);
  if (!school) return null;
  const district = getDistrictById(school.districtId);
  if (!district) return null;

  const rows = await readMasterRoster(context);
  const actor = findUserById(actorUserId);
  const created: TenantStudentRecord = {
    id: makeMasterId(rows),
    name: input.name,
    grade: input.grade,
    tier: input.tier,
    gpa: input.gpa,
    attendance: input.attendance,
    readingLevel: input.readingLevel,
    activeInterventions: input.tier === Tier.TIER_1 ? 0 : 1,
    alerts: input.tier === Tier.TIER_3 ? 1 : 0,
    avatarSeed: toAvatarSeed(input.name),
    organizationId: district.organizationId,
    districtId: district.id,
    schoolId: targetSchoolId,
    teacherUserId: input.teacherUserId ?? (actorUserId.startsWith("u-teacher") ? actorUserId : undefined),
    teacherName: input.teacherName ?? actor?.name ?? undefined,
    status: input.status ?? (input.tier === Tier.TIER_1 ? "monitoring" : "active"),
    isArchived: false,
    guardianUserIds: [],
  };

  await upsertStudentRowByTenant(toTenantKey(context), STUDENTS_MASTER_SCOPE, toCanonicalStudent(created));
  return cloneStudent(toCanonicalStudent(created));
};

export const updateMasterStudent = async (
  studentId: string,
  patch: UpdateStudentInput,
  context: TenantContext
): Promise<TenantStudentRecord | null> => {
  const rows = await readMasterRoster(context);
  const index = rows.findIndex((student) => student.id === studentId);
  if (index < 0) return null;
  const current = rows[index];
  if (!contextContainsStudent(context, current)) return null;

  const updated: TenantStudentRecord = {
    ...current,
    ...patch,
    status: patch.status ?? (patch.tier ? (patch.tier === Tier.TIER_1 ? "monitoring" : "active") : current.status),
    avatarSeed: patch.name ? toAvatarSeed(patch.name) : current.avatarSeed,
  };

  await upsertStudentRowByTenant(toTenantKey(context), STUDENTS_MASTER_SCOPE, toCanonicalStudent(updated));
  return cloneStudent(toCanonicalStudent(updated));
};

export const archiveMasterStudents = async (
  studentIds: string[],
  context: TenantContext,
  isArchived = true
): Promise<TenantStudentRecord[]> => {
  const rows = await readMasterRoster(context);
  const idSet = new Set(studentIds);
  const nextRows = rows.map((student) => {
    if (!idSet.has(student.id) || !contextContainsStudent(context, student)) return student;
    return {
      ...student,
      isArchived,
      status: isArchived && student.status === "active" ? "monitoring" : student.status,
    };
  });

  await replaceMasterRoster(context, nextRows);
  return nextRows.filter((student) => idSet.has(student.id)).map((student) => cloneStudent(toCanonicalStudent(student)));
};

export const deleteMasterStudent = async (studentId: string, context: TenantContext): Promise<TenantStudentRecord | null> => {
  const rows = await readMasterRoster(context);
  const existing = rows.find((student) => student.id === studentId);
  if (!existing || !contextContainsStudent(context, existing)) return null;

  const nextRows = rows.filter((student) => student.id !== studentId);
  await deleteStudentRowByTenant(toTenantKey(context), STUDENTS_MASTER_SCOPE, studentId);
  if (nextRows.length === 0) {
    await writeTenantCollection(toTenantKey(context), STUDENTS_MASTER_DOMAIN, []);
  }
  return cloneStudent(toCanonicalStudent(existing));
};
