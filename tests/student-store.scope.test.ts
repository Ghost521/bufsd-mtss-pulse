import { describe, expect, it } from "vitest";
import { listStudents } from "../src/lib/server/student-store";
import type { TenantContext } from "../src/lib/server/tenant-types";

const schoolContext: TenantContext = {
  organizationId: "org-bufsd",
  districtId: "dist-bufsd",
  schoolId: "sch-ne",
};

const districtContext: TenantContext = {
  organizationId: "org-bufsd",
  districtId: "dist-bufsd",
};

describe("student-store role and hierarchy filtering", () => {
  it("restricts teachers to their own classroom roster", async () => {
    const rows = await listStudents({
      scope: "master",
      context: schoolContext,
      requesterUserId: "u-teacher-other",
      requesterRoles: ["teacher"],
    });

    expect(rows).toHaveLength(0);
  });

  it("allows school admins to read school-level roster", async () => {
    const rows = await listStudents({
      scope: "master",
      context: schoolContext,
      requesterUserId: "u-school-admin-ne",
      requesterRoles: ["school_admin"],
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.schoolId))).toEqual(new Set(["sch-ne"]));
  });

  it("supports principal-based hierarchy filtering", async () => {
    const rows = await listStudents({
      scope: "master",
      context: districtContext,
      requesterUserId: "u-district-admin-bufsd",
      requesterRoles: ["district_admin"],
      filters: { principalUserId: "u-principal-ne" },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.schoolId))).toEqual(new Set(["sch-ne"]));
  });

  it("supports placeholder principal node filters", async () => {
    const rows = await listStudents({
      scope: "master",
      context: districtContext,
      requesterUserId: "u-district-admin-bufsd",
      requesterRoles: ["district_admin"],
      filters: { principalUserId: "none:sch-west" },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((row) => row.schoolId))).toEqual(new Set(["sch-west"]));
  });
});
