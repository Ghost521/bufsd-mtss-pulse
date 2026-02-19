import { describe, expect, it } from "vitest";
import { Tier } from "../src/types";
import {
  archiveStudentsInputSchema,
  createStudentInputSchema,
  tenantStudentRecordSchema,
  updateStudentInputSchema,
} from "../src/lib/schemas/students";

describe("students schema", () => {
  it("accepts archive payload with ids", () => {
    const parsed = archiveStudentsInputSchema.safeParse({ ids: ["STU-1001", "STU-1002"] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.isArchived).toBe(true);
  });

  it("accepts teacher and lifecycle fields on create/update", () => {
    const created = createStudentInputSchema.safeParse({
      name: "Leo Martinez",
      grade: "4th",
      tier: Tier.TIER_2,
      gpa: "2.8",
      attendance: 93,
      readingLevel: "M",
      teacherName: "Mr. Davis",
      status: "active",
    });
    expect(created.success).toBe(true);

    const updated = updateStudentInputSchema.safeParse({
      teacherName: "Mrs. Johnson",
      status: "monitoring",
      isArchived: true,
    });
    expect(updated.success).toBe(true);
  });

  it("defaults canonical status and archive flags on tenant rows", () => {
    const parsed = tenantStudentRecordSchema.safeParse({
      id: "STU-1001",
      name: "Test Student",
      grade: "4th",
      tier: Tier.TIER_1,
      gpa: "3.2",
      attendance: 95,
      readingLevel: "N",
      activeInterventions: 0,
      alerts: 0,
      avatarSeed: "test-student",
      organizationId: "org-bufsd",
      districtId: "dist-bufsd",
      schoolId: "sch-ne",
      guardianUserIds: [],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.status).toBe("unknown");
    expect(parsed.data.isArchived).toBe(false);
  });
});
