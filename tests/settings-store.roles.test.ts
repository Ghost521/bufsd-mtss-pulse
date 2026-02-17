import { describe, expect, it } from "vitest";
import { isSettingsSectionAllowedForRoles } from "../src/lib/server/settings-store";
import type { SettingsSectionId } from "../src/lib/schemas/settings";
import type { RoleKey } from "../src/lib/server/tenant-types";

describe("isSettingsSectionAllowedForRoles", () => {
  it("allows shared sections for all roles", () => {
    const sharedSections: SettingsSectionId[] = ["profile", "notifications", "security"];
    const roles: RoleKey[] = ["org_admin", "district_admin", "principal", "teacher", "parent"];

    for (const role of roles) {
      for (const section of sharedSections) {
        expect(isSettingsSectionAllowedForRoles(section, [role])).toBe(true);
      }
    }
  });

  it("enforces role-restricted sections", () => {
    expect(isSettingsSectionAllowedForRoles("preferences", ["parent"])).toBe(true);
    expect(isSettingsSectionAllowedForRoles("preferences", ["teacher"])).toBe(false);

    expect(isSettingsSectionAllowedForRoles("classroom", ["teacher"])).toBe(true);
    expect(isSettingsSectionAllowedForRoles("classroom", ["principal"])).toBe(false);

    expect(isSettingsSectionAllowedForRoles("system", ["principal"])).toBe(true);
    expect(isSettingsSectionAllowedForRoles("system", ["district_admin"])).toBe(true);
    expect(isSettingsSectionAllowedForRoles("system", ["org_admin"])).toBe(true);
    expect(isSettingsSectionAllowedForRoles("system", ["teacher"])).toBe(false);
    expect(isSettingsSectionAllowedForRoles("system", ["parent"])).toBe(false);
  });

  it("allows section access when any assigned role matches", () => {
    expect(isSettingsSectionAllowedForRoles("system", ["teacher", "principal"])).toBe(true);
    expect(isSettingsSectionAllowedForRoles("preferences", ["teacher", "parent"])).toBe(true);
    expect(isSettingsSectionAllowedForRoles("classroom", ["parent", "teacher"])).toBe(true);
  });
});
