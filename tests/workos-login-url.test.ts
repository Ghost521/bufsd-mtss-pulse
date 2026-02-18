import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const getAuthorizationUrlMock = vi.fn();

vi.mock("@workos-inc/node", () => ({
  WorkOS: class WorkOSMock {
    userManagement = {
      getAuthorizationUrl: getAuthorizationUrlMock,
    };
  },
}));

const restoreEnv = () => {
  const originalKeys = new Set(Object.keys(ORIGINAL_ENV));
  for (const key of Object.keys(process.env)) {
    if (!originalKeys.has(key)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
};

const loadWorkOSModule = async () => import("../src/lib/server/workos");

describe("createWorkOSLoginUrl prompt behavior", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthorizationUrlMock.mockReset();
    getAuthorizationUrlMock.mockReturnValue("https://workos.example/authorize");

    process.env.WORKOS_API_KEY = "test_workos_api_key";
    process.env.WORKOS_CLIENT_ID = "test_workos_client_id";
    process.env.WORKOS_COOKIE_PASSWORD = "test_cookie_password";
    process.env.WORKOS_PROVIDER = "authkit";
    process.env.APP_BASE_URL = "http://localhost:3000";
    delete process.env.WORKOS_CONNECTION_ID;
    delete process.env.WORKOS_REDIRECT_URI;
  });

  afterEach(() => {
    restoreEnv();
    vi.clearAllMocks();
  });

  it("passes prompt=login when forcePromptLogin is true", async () => {
    const { createWorkOSLoginUrl } = await loadWorkOSModule();

    const url = createWorkOSLoginUrl("state-1", "http://localhost:3000/api/auth/login", {
      forcePromptLogin: true,
    });

    expect(url).toBe("https://workos.example/authorize");
    expect(getAuthorizationUrlMock).toHaveBeenCalledTimes(1);
    expect(getAuthorizationUrlMock.mock.calls[0]?.[0]).toMatchObject({
      state: "state-1",
      prompt: "login",
    });
  });

  it("omits prompt when forcePromptLogin is false or omitted", async () => {
    const { createWorkOSLoginUrl } = await loadWorkOSModule();

    createWorkOSLoginUrl("state-2", "http://localhost:3000/api/auth/login");
    createWorkOSLoginUrl("state-3", "http://localhost:3000/api/auth/login", { forcePromptLogin: false });

    expect(getAuthorizationUrlMock).toHaveBeenCalledTimes(2);
    const firstCall = getAuthorizationUrlMock.mock.calls[0]?.[0] as Record<string, unknown>;
    const secondCall = getAuthorizationUrlMock.mock.calls[1]?.[0] as Record<string, unknown>;

    expect(firstCall).not.toHaveProperty("prompt");
    expect(secondCall).not.toHaveProperty("prompt");
  });
});
