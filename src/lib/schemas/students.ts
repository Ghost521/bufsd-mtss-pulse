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
});

export const updateStudentInputSchema = z
  .object({
    name: createStudentInputSchema.shape.name.optional(),
    grade: createStudentInputSchema.shape.grade.optional(),
    tier: createStudentInputSchema.shape.tier.optional(),
    gpa: createStudentInputSchema.shape.gpa.optional(),
    attendance: attendanceNumberSchema.optional(),
    readingLevel: createStudentInputSchema.shape.readingLevel.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
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
  guardianUserIds: z.array(z.string().trim().min(1).max(80)),
});

export const tenantStudentCollectionSchema = z.array(tenantStudentRecordSchema);

export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentInputSchema>;
export type TenantStudentRecord = z.infer<typeof tenantStudentRecordSchema>;
