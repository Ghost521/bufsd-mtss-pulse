import { z } from "zod";
import { Tier } from "../../types";

const nonEmptyTrimmedString = (label: string, max = 160) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const attendanceNumberSchema = z
  .coerce
  .number({ error: "Attendance must be a number." })
  .refine((value) => Number.isFinite(value), { message: "Attendance must be a finite number." })
  .transform((value) => Math.max(0, Math.min(100, Math.round(value))));

export const createStudentInputSchema = z.object({
  name: nonEmptyTrimmedString("Student name", 120),
  grade: nonEmptyTrimmedString("Grade", 24),
  tier: z.nativeEnum(Tier),
  gpa: nonEmptyTrimmedString("GPA", 24),
  attendance: attendanceNumberSchema,
  readingLevel: nonEmptyTrimmedString("Reading level", 24),
  schoolId: nonEmptyTrimmedString("School", 64).optional(),
  teacherUserId: nonEmptyTrimmedString("Teacher user", 80).optional(),
  teacherName: nonEmptyTrimmedString("Teacher name", 120).optional(),
  status: z.enum(["active", "monitoring", "completed", "unknown"]).optional(),
});

export const updateStudentInputSchema = z
  .object({
    name: createStudentInputSchema.shape.name.optional(),
    grade: createStudentInputSchema.shape.grade.optional(),
    tier: createStudentInputSchema.shape.tier.optional(),
    gpa: createStudentInputSchema.shape.gpa.optional(),
    attendance: attendanceNumberSchema.optional(),
    readingLevel: createStudentInputSchema.shape.readingLevel.optional(),
    teacherUserId: createStudentInputSchema.shape.teacherUserId.optional(),
    teacherName: createStudentInputSchema.shape.teacherName.optional(),
    status: createStudentInputSchema.shape.status.optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const archiveStudentsInputSchema = z.object({
  ids: z.array(nonEmptyTrimmedString("Student id", 80)).min(1, "Select at least one student."),
  isArchived: z.boolean().default(true),
});

export const tenantStudentRecordSchema = z.object({
  id: nonEmptyTrimmedString("Student id", 80),
  name: createStudentInputSchema.shape.name,
  grade: createStudentInputSchema.shape.grade,
  tier: createStudentInputSchema.shape.tier,
  gpa: createStudentInputSchema.shape.gpa,
  attendance: z.number().int().min(0).max(100),
  readingLevel: createStudentInputSchema.shape.readingLevel,
  activeInterventions: z.number().int().min(0),
  alerts: z.number().int().min(0),
  avatarSeed: nonEmptyTrimmedString("Avatar seed", 120),
  organizationId: nonEmptyTrimmedString("Organization id", 80),
  districtId: nonEmptyTrimmedString("District id", 80),
  schoolId: nonEmptyTrimmedString("School id", 80),
  teacherUserId: z.string().trim().min(1).max(80).optional(),
  teacherName: nonEmptyTrimmedString("Teacher name", 120).optional(),
  teacher: nonEmptyTrimmedString("Teacher", 120).optional(),
  status: z.enum(["active", "monitoring", "completed", "unknown"]).default("unknown"),
  isArchived: z.boolean().default(false),
  guardianUserIds: z.array(z.string().trim().min(1).max(80)),
});

export const tenantStudentCollectionSchema = z.array(tenantStudentRecordSchema);

export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentInputSchema>;
export type ArchiveStudentsInput = z.infer<typeof archiveStudentsInputSchema>;
export type TenantStudentRecord = z.infer<typeof tenantStudentRecordSchema>;
