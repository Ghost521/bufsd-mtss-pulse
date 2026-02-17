import { CLASS_ROSTER_DATA, generateMasterRoster } from "../../constants";
import { Tier } from "../../types";
import { tenantStudentCollectionSchema, tenantStudentRecordSchema, type CreateStudentInput, type TenantStudentRecord, type UpdateStudentInput } from "../schemas/students";
import { getDistricts, getSchools } from "./tenant-store";
import { readTenantCollection, toTenantKey, writeTenantCollection } from "./persistence";
import type { TenantContext } from "./tenant-types";

export type StudentScope = "master" | "class";
export type { CreateStudentInput, UpdateStudentInput, TenantStudentRecord };

type StudentListOptions = {
  scope: StudentScope;
  context: TenantContext;
  requesterUserId: string;
  requesterRoles: string[];
};

const STUDENTS_MASTER_DOMAIN = "students_master";
const STUDENTS_CLASS_DOMAIN = "students_class";

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

const parseStoredRows = (rows: unknown): TenantStudentRecord[] => {
  const parsed = tenantStudentCollectionSchema.safeParse(rows);
  if (parsed.success) return parsed.data;

  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => tenantStudentRecordSchema.safeParse(row))
    .filter((candidate): candidate is { success: true; data: TenantStudentRecord } => candidate.success)
    .map((candidate) => candidate.data);
};

const assignTenantMetadata = (student: Omit<TenantStudentRecord, "organizationId" | "districtId" | "schoolId" | "teacherUserId" | "guardianUserIds">, schoolId: string): TenantStudentRecord | null => {
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
      guardianUserIds: id === "STU-LEO-1" ? ["u-parent-leo"] : [],
      avatarSeed: toAvatarSeed(student.name),
    };
  });

const readMasterRoster = async (context: TenantContext): Promise<TenantStudentRecord[]> => {
  const tenantKey = toTenantKey(context);
  const rows = await readTenantCollection<unknown>(tenantKey, STUDENTS_MASTER_DOMAIN, seedMasterRoster);
  return sortMasterRoster(parseStoredRows(rows));
};

const readClassRoster = async (context: TenantContext): Promise<TenantStudentRecord[]> => {
  const tenantKey = toTenantKey(context);
  const rows = await readTenantCollection<unknown>(tenantKey, STUDENTS_CLASS_DOMAIN, seedClassRoster);
  return parseStoredRows(rows);
};

const writeMasterRoster = async (context: TenantContext, rows: TenantStudentRecord[]): Promise<void> => {
  const tenantKey = toTenantKey(context);
  const validRows = tenantStudentCollectionSchema.parse(sortMasterRoster(rows));
  await writeTenantCollection(tenantKey, STUDENTS_MASTER_DOMAIN, validRows);
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

const filterByRole = (
  rows: TenantStudentRecord[],
  requesterUserId: string,
  requesterRoles: string[]
): TenantStudentRecord[] => {
  if (requesterRoles.includes("parent")) {
    return rows.filter((student) => student.guardianUserIds.includes(requesterUserId));
  }
  if (requesterRoles.includes("teacher")) {
    return rows.filter((student) => student.teacherUserId === requesterUserId || student.schoolId === "sch-ne");
  }
  return rows;
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
  return cloneStudents(roleScoped);
};

export const getStudentById = async (studentId: string, context: TenantContext): Promise<TenantStudentRecord | null> => {
  const [masterRows, classRows] = await Promise.all([readMasterRoster(context), readClassRoster(context)]);
  const found = masterRows.find((student) => student.id === studentId) ?? classRows.find((student) => student.id === studentId);
  return found ? cloneStudent(found) : null;
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
    teacherUserId: actorUserId.startsWith("u-teacher") ? actorUserId : undefined,
    guardianUserIds: [],
  };

  await writeMasterRoster(context, [...rows, created]);
  return cloneStudent(created);
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
    avatarSeed: patch.name ? toAvatarSeed(patch.name) : current.avatarSeed,
  };

  const nextRows = [...rows];
  nextRows[index] = updated;
  await writeMasterRoster(context, nextRows);
  return cloneStudent(updated);
};

export const deleteMasterStudent = async (studentId: string, context: TenantContext): Promise<TenantStudentRecord | null> => {
  const rows = await readMasterRoster(context);
  const existing = rows.find((student) => student.id === studentId);
  if (!existing || !contextContainsStudent(context, existing)) return null;

  const nextRows = rows.filter((student) => student.id !== studentId);
  await writeMasterRoster(context, nextRows);
  return cloneStudent(existing);
};
