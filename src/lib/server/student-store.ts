import { CLASS_ROSTER_DATA, generateMasterRoster } from "../../constants";
import { Tier, type StudentRosterItem } from "../../types";
import { getDistricts, getSchools } from "./tenant-store";
import type { TenantContext } from "./tenant-types";

export type StudentScope = "master" | "class";

export type CreateStudentInput = Pick<
  StudentRosterItem,
  "name" | "grade" | "tier" | "gpa" | "attendance" | "readingLevel"
> & {
  schoolId?: string;
};

export type UpdateStudentInput = Partial<CreateStudentInput>;

export type TenantStudentRecord = StudentRosterItem & {
  organizationId: string;
  districtId: string;
  schoolId: string;
  teacherUserId?: string;
  guardianUserIds: string[];
};

type StudentListOptions = {
  scope: StudentScope;
  context: TenantContext;
  requesterUserId: string;
  requesterRoles: string[];
};

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
  rows.sort((a, b) => {
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

const assignTenantMetadata = (student: StudentRosterItem, schoolId: string): TenantStudentRecord | null => {
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

let masterRosterStore = seedMasterRoster();
let classRosterStore = seedClassRoster();
let nextMasterId = masterRosterStore.reduce((max, item) => Math.max(max, extractNumericId(item.id)), 1000) + 1;

const makeMasterId = (): string => {
  const id = `STU-M-${nextMasterId}`;
  nextMasterId += 1;
  return id;
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

export const listStudents = (options: StudentListOptions): TenantStudentRecord[] => {
  const baseStore = options.scope === "master" ? masterRosterStore : classRosterStore;
  const scoped = baseStore.filter((student) => contextContainsStudent(options.context, student));
  const roleScoped = filterByRole(scoped, options.requesterUserId, options.requesterRoles);
  return cloneStudents(roleScoped);
};

export const getStudentById = (studentId: string): TenantStudentRecord | null => {
  const found = masterRosterStore.find((student) => student.id === studentId) ?? classRosterStore.find((student) => student.id === studentId);
  return found ? cloneStudent(found) : null;
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

export const createMasterStudent = (
  input: CreateStudentInput,
  context: TenantContext,
  actorUserId: string
): TenantStudentRecord | null => {
  const targetSchoolId = resolveTargetSchoolForCreate(context, input.schoolId);
  if (!targetSchoolId) return null;
  const school = getSchoolById(targetSchoolId);
  if (!school) return null;
  const district = getDistrictById(school.districtId);
  if (!district) return null;

  const created: TenantStudentRecord = {
    id: makeMasterId(),
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

  masterRosterStore = sortMasterRoster([...masterRosterStore, created]);
  return cloneStudent(created);
};

export const updateMasterStudent = (
  studentId: string,
  patch: UpdateStudentInput,
  context: TenantContext
): TenantStudentRecord | null => {
  const index = masterRosterStore.findIndex((student) => student.id === studentId);
  if (index < 0) return null;
  const current = masterRosterStore[index];
  if (!contextContainsStudent(context, current)) return null;

  const updated: TenantStudentRecord = {
    ...current,
    ...patch,
    avatarSeed: patch.name ? toAvatarSeed(patch.name) : current.avatarSeed,
  };

  masterRosterStore = cloneStudents(masterRosterStore);
  masterRosterStore[index] = updated;
  masterRosterStore = sortMasterRoster(masterRosterStore);
  return cloneStudent(updated);
};

export const deleteMasterStudent = (studentId: string, context: TenantContext): TenantStudentRecord | null => {
  const existing = masterRosterStore.find((student) => student.id === studentId);
  if (!existing || !contextContainsStudent(context, existing)) return null;

  masterRosterStore = masterRosterStore.filter((student) => student.id !== studentId);
  return cloneStudent(existing);
};
