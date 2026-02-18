import { describe, expect, it } from "vitest";
import { isBrandingManageAllowedForRoles } from "../src/lib/server/branding-store";

describe("branding role access", () => {
  it("allows district and org administrators to manage branding", () => {
    expect(isBrandingManageAllowedForRoles(["district_admin"])).toBe(true);
    expect(isBrandingManageAllowedForRoles(["org_admin"])).toBe(true);
  });

  it("prevents non-admin roles from managing branding", () => {
    expect(isBrandingManageAllowedForRoles(["principal"])).toBe(false);
    expect(isBrandingManageAllowedForRoles(["teacher", "parent"])).toBe(false);
  });
});
