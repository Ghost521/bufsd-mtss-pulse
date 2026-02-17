import { CLASS_ROSTER_DATA, generateMasterRoster } from "../../constants";
import { Tier, type StudentRosterItem } from "../../types";

export type StudentScope = "master" | "class";

export type CreateStudentInput = Pick<
  StudentRosterItem,
  "name" | "grade" | "tier" | "gpa" | "attendance" | "readingLevel"
>;

export type UpdateStudentInput = Partial<CreateStudentInput>;

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

const sortMasterRoster = (rows: StudentRosterItem[]): StudentRosterItem[] =>
  rows.sort((a, b) => {
    const tierDiff = tierScore(b.tier) - tierScore(a.tier);
    if (tierDiff !== 0) return tierDiff;
    return a.name.localeCompare(b.name);
  });

const cloneStudent = (student: StudentRosterItem): StudentRosterItem => ({ ...student });
const cloneStudents = (rows: StudentRosterItem[]): StudentRosterItem[] => rows.map(cloneStudent);

const extractNumericId = (id: string): number => {
  const matched = id.match(/(\d+)$/);
  return matched ? Number(matched[1]) : 0;
};

const toAvatarSeed = (name: string): string => name.trim().replace(/\s+/g, "-").toLowerCase();

let masterRosterStore = sortMasterRoster(generateMasterRoster());
let classRosterStore = cloneStudents(CLASS_ROSTER_DATA);
let nextMasterId = masterRosterStore.reduce((max, item) => Math.max(max, extractNumericId(item.id)), 1000) + 1;

const makeMasterId = (): string => {
  const id = `STU-M-${nextMasterId}`;
  nextMasterId += 1;
  return id;
};

const getStoreByScope = (scope: StudentScope): StudentRosterItem[] =>
  scope === "master" ? masterRosterStore : classRosterStore;

export const listStudents = (scope: StudentScope): StudentRosterItem[] => cloneStudents(getStoreByScope(scope));

export const createMasterStudent = (input: CreateStudentInput): StudentRosterItem => {
  const created: StudentRosterItem = {
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
  };

  masterRosterStore = sortMasterRoster([...masterRosterStore, created]);
  return cloneStudent(created);
};

export const updateMasterStudent = (studentId: string, patch: UpdateStudentInput): StudentRosterItem | null => {
  const index = masterRosterStore.findIndex((student) => student.id === studentId);
  if (index < 0) return null;

  const current = masterRosterStore[index];
  const updated: StudentRosterItem = {
    ...current,
    ...patch,
    avatarSeed: patch.name ? toAvatarSeed(patch.name) : current.avatarSeed,
  };

  masterRosterStore = cloneStudents(masterRosterStore);
  masterRosterStore[index] = updated;
  masterRosterStore = sortMasterRoster(masterRosterStore);
  return cloneStudent(updated);
};

export const deleteMasterStudent = (studentId: string): StudentRosterItem | null => {
  const existing = masterRosterStore.find((student) => student.id === studentId);
  if (!existing) return null;

  masterRosterStore = masterRosterStore.filter((student) => student.id !== studentId);
  return cloneStudent(existing);
};
