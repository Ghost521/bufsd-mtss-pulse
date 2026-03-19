import { describe, expect, it } from "vitest";
import { writeTenantCollection } from "../src/lib/server/persistence";
import { ensureTenantStoreHydrated, getUsers, refreshTenantStore } from "../src/lib/server/tenant-store";

const TENANT_AUTH_STORE_KEY = "__tenant_auth__";

describe("tenant-store refresh", () => {
  it("reloads tenant users from persistence instead of serving stale in-memory state", async () => {
    await ensureTenantStoreHydrated();
    const originalUsers = getUsers();
    const injectedUser = {
      id: "u-refresh-test",
      name: "Refresh Test User",
      email: "refresh.test@example.com",
      primaryRole: "teacher" as const,
    };

    try {
      await writeTenantCollection(TENANT_AUTH_STORE_KEY, "tenant_users", [injectedUser, ...originalUsers]);

      expect(getUsers().some((user) => user.id === injectedUser.id)).toBe(false);

      await refreshTenantStore();
      expect(getUsers().some((user) => user.id === injectedUser.id)).toBe(true);
    } finally {
      await writeTenantCollection(TENANT_AUTH_STORE_KEY, "tenant_users", originalUsers);
      await refreshTenantStore();
    }
  });
});
