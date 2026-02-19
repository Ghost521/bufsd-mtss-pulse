import { readTenantCollection, toTenantKey, writeTenantCollection } from "./persistence";
import type { SessionContext, RoleKey } from "./tenant-types";
import {
  settingsRecordSchema,
  settingsSectionSchemaMap,
  type SettingsRecord,
  type SettingsSectionId,
} from "../schemas/settings";
import { READING_BENCHMARK_GRADE_ORDER, normalizeReadingLevel } from "../reading-benchmarks";

export class SettingsStoreError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SettingsStoreError";
    this.status = status;
  }
}

const SETTINGS_DOMAIN = "settings" as const;

const hasAnyRole = (roles: RoleKey[], required: RoleKey[]): boolean =>
  required.some((role) => roles.includes(role));

const normalizeReadingBenchmarks = (
  value: SettingsRecord["system"]["readingBenchmarks"],
): SettingsRecord["system"]["readingBenchmarks"] => {
  if (!value) return undefined;

  const next: NonNullable<SettingsRecord["system"]["readingBenchmarks"]> = {};
  for (const grade of READING_BENCHMARK_GRADE_ORDER) {
    const candidate = value[grade];
    if (!candidate) continue;

    const min = normalizeReadingLevel(candidate.min);
    const max = normalizeReadingLevel(candidate.max);
    if (!min || !max || min > max) continue;
    next[grade] = { min, max };
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

const normalizeSystemSettings = (value: SettingsRecord["system"]): SettingsRecord["system"] => ({
  ...value,
  readingBenchmarks: normalizeReadingBenchmarks(value.readingBenchmarks),
});

export const isSettingsSectionAllowedForRoles = (section: SettingsSectionId, roles: RoleKey[]): boolean => {
  if (section === "profile" || section === "notifications" || section === "security") return true;
  if (section === "preferences") return roles.includes("parent");
  if (section === "classroom") return roles.includes("teacher");
  if (section === "system") return hasAnyRole(roles, ["principal", "school_admin", "district_admin", "org_admin"]);
  return false;
};

const createDefaultRecord = (session: SessionContext): SettingsRecord => {
  const now = new Date().toISOString();
  return {
    id: `settings::${session.user.id}`,
    userId: session.user.id,
    version: 1,
    profile: {
      displayName: session.user.name,
      email: session.user.email,
      bio: "",
      timezone: "America/New_York",
      avatarUrl: null,
    },
    notifications: {
      emailNotifications: true,
      pushNotifications: false,
      digestFrequency: "Daily",
      alerts: {
        newMessageReceived: true,
        mtssMeetingScheduled: true,
        interventionPlanGoalMet: true,
        studentFlaggedAtRisk: true,
      },
    },
    security: {
      twoFactorEnabled: true,
      providerManagedAuth: true,
      lastPasswordChangedAt: null,
    },
    preferences: {
      preferredLanguage: "English",
      contactMethodPriority: "Email first, then Phone",
    },
    classroom: {
      autoFlagLowAttendance: true,
      weeklyParentSummary: true,
    },
    system: {
      infiniteCampusConnected: true,
      cleverConnected: true,
      powerSchoolConnected: false,
    },
    updatedAt: now,
    updatedBy: session.user.id,
  };
};

const readTenantSettingsRows = async (session: SessionContext): Promise<SettingsRecord[]> => {
  const tenantKey = toTenantKey(session.activeContext);
  const rows = await readTenantCollection<SettingsRecord>(tenantKey, SETTINGS_DOMAIN, () => []);
  return Array.isArray(rows)
    ? rows
        .map((row) => settingsRecordSchema.safeParse(row))
        .filter((parsed) => parsed.success)
        .map((parsed) => parsed.data)
    : [];
};

const writeTenantSettingsRows = async (session: SessionContext, rows: SettingsRecord[]): Promise<void> => {
  const tenantKey = toTenantKey(session.activeContext);
  await writeTenantCollection(tenantKey, SETTINGS_DOMAIN, rows);
};

export const getOrCreateUserSettings = async (session: SessionContext): Promise<SettingsRecord> => {
  const rows = await readTenantSettingsRows(session);
  const existing = rows.find((row) => row.userId === session.user.id);
  if (existing) return existing;

  const created = createDefaultRecord(session);
  await writeTenantSettingsRows(session, [created, ...rows]);
  return created;
};

export const updateUserSettingsSection = async <TSection extends SettingsSectionId>(
  session: SessionContext,
  section: TSection,
  data: unknown
): Promise<SettingsRecord> => {
  if (!isSettingsSectionAllowedForRoles(section, session.effectiveRoles)) {
    throw new SettingsStoreError("You do not have permission to update this settings section.", 403);
  }

  const parsedSection = settingsSectionSchemaMap[section].safeParse(data);
  if (!parsedSection.success) {
    throw new SettingsStoreError(parsedSection.error.issues[0]?.message ?? "Invalid settings payload.", 400);
  }

  const sectionData =
    section === "system"
      ? normalizeSystemSettings(parsedSection.data as SettingsRecord["system"])
      : parsedSection.data;

  const rows = await readTenantSettingsRows(session);
  const fallback = createDefaultRecord(session);
  const existing = rows.find((row) => row.userId === session.user.id) ?? fallback;
  const next: SettingsRecord = settingsRecordSchema.parse({
    ...existing,
    [section]: sectionData,
    security: {
      ...existing.security,
      providerManagedAuth: true,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: session.user.id,
  });

  const nextRows = rows.some((row) => row.userId === session.user.id)
    ? rows.map((row) => (row.userId === session.user.id ? next : row))
    : [next, ...rows];

  await writeTenantSettingsRows(session, nextRows);
  return next;
};
