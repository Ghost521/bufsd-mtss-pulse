import { describe, expect, it } from "vitest";

import { UserRole } from "../src/types";
import { buildWorkspacePath, ROLE_ALLOWED_PAGES, slugToPage } from "../src/lib/workspaceRoutes";

describe("workspace notifications route", () => {
  it("maps notifications slug to page id", () => {
    expect(slugToPage("notifications")).toBe("notifications");
    expect(buildWorkspacePath("notifications")).toBe("/app/notifications");
  });

  it("allows notifications page for all roles", () => {
    expect(ROLE_ALLOWED_PAGES[UserRole.PRINCIPAL]).toContain("notifications");
    expect(ROLE_ALLOWED_PAGES[UserRole.TEACHER]).toContain("notifications");
    expect(ROLE_ALLOWED_PAGES[UserRole.DISTRICT]).toContain("notifications");
    expect(ROLE_ALLOWED_PAGES[UserRole.PARENT]).toContain("notifications");
  });
});

