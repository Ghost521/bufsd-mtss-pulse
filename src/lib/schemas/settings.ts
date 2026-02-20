import { z } from "zod";
import { READING_BENCHMARK_GRADE_ORDER, type NormalizedGrade } from "../reading-benchmarks";

export const settingsSectionIds = [
  "profile",
  "notifications",
  "security",
  "preferences",
  "classroom",
  "system",
] as const;

export type SettingsSectionId = (typeof settingsSectionIds)[number];

export const digestFrequencySchema = z.enum(["Instant", "Daily", "Weekly"]);
export const preferredLanguageSchema = z.enum(["English", "Spanish", "Mandarin", "Arabic"]);
export const contactPrioritySchema = z.enum([
  "Email first, then Phone",
  "Phone first, then Email",
  "SMS Only",
]);

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(2, "Display name must be at least 2 characters.").max(80),
  email: z.string().trim().email("Enter a valid email address.").max(160),
  bio: z.string().trim().max(280, "Bio must be 280 characters or fewer."),
  timezone: z.string().trim().min(1, "Timezone is required.").max(120).default("America/New_York"),
  avatarUrl: z.string().max(2_000_000).nullable().optional(),
});

export const notificationAlertsSchema = z.object({
  newMessageReceived: z.boolean(),
  mtssMeetingScheduled: z.boolean(),
  interventionPlanGoalMet: z.boolean(),
  studentFlaggedAtRisk: z.boolean(),
});

export const notificationsSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  digestFrequency: digestFrequencySchema,
  alerts: notificationAlertsSchema,
});

export const securitySettingsSchema = z.object({
  twoFactorEnabled: z.boolean(),
  providerManagedAuth: z.boolean(),
  lastPasswordChangedAt: z.string().datetime().nullable(),
});

export const preferencesSettingsSchema = z.object({
  preferredLanguage: preferredLanguageSchema,
  contactMethodPriority: contactPrioritySchema,
});

export const classroomSettingsSchema = z.object({
  autoFlagLowAttendance: z.boolean(),
  weeklyParentSummary: z.boolean(),
});

const readingBenchmarkBandSchema = z
  .object({
    min: z.string().trim().regex(/^[A-Za-z]$/, "Use one letter from A to Z.").transform((value) => value.toUpperCase()),
    max: z.string().trim().regex(/^[A-Za-z]$/, "Use one letter from A to Z.").transform((value) => value.toUpperCase()),
  })
  .superRefine((value, context) => {
    if (value.min > value.max) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Maximum level must be greater than or equal to minimum level.",
        path: ["max"],
      });
    }
  });

export const readingBenchmarkOverridesSchema = z
  .record(z.string(), readingBenchmarkBandSchema)
  .superRefine((value, context) => {
    for (const key of Object.keys(value)) {
      if (!READING_BENCHMARK_GRADE_ORDER.includes(key as NormalizedGrade)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Grade key must be one of K, 1, 2, 3, 4, 5, 6, 7, 8.",
          path: [key],
        });
      }
    }
  })
  .transform((value) => {
    const next: Partial<Record<NormalizedGrade, { min: string; max: string }>> = {};
    for (const grade of READING_BENCHMARK_GRADE_ORDER) {
      const band = value[grade];
      if (!band) continue;
      next[grade] = { min: band.min, max: band.max };
    }
    return next;
  });

export const systemSettingsSchema = z.object({
  infiniteCampusConnected: z.boolean(),
  cleverConnected: z.boolean(),
  powerSchoolConnected: z.boolean(),
  eSchoolDataConnected: z.boolean().default(false),
  readingBenchmarks: readingBenchmarkOverridesSchema.optional(),
});

export const settingsRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  version: z.literal(1),
  profile: profileSettingsSchema,
  notifications: notificationsSettingsSchema,
  security: securitySettingsSchema,
  preferences: preferencesSettingsSchema,
  classroom: classroomSettingsSchema,
  system: systemSettingsSchema,
  updatedAt: z.string().datetime(),
  updatedBy: z.string().min(1),
});

export type SettingsRecord = z.infer<typeof settingsRecordSchema>;
export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export type NotificationsSettings = z.infer<typeof notificationsSettingsSchema>;
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;
export type PreferencesSettings = z.infer<typeof preferencesSettingsSchema>;
export type ClassroomSettings = z.infer<typeof classroomSettingsSchema>;
export type SystemSettings = z.infer<typeof systemSettingsSchema>;

export const settingsSectionSchemaMap = {
  profile: profileSettingsSchema,
  notifications: notificationsSettingsSchema,
  security: securitySettingsSchema,
  preferences: preferencesSettingsSchema,
  classroom: classroomSettingsSchema,
  system: systemSettingsSchema,
} as const;

export const sectionUpdateRequestSchema = z.object({
  section: z.enum(settingsSectionIds),
  data: z.unknown(),
});
