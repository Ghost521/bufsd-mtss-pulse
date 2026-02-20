// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsView } from "../src/components/SettingsView";
import { UserRole } from "../src/types";

type MockResponseConfig = {
  status: number;
  body: Record<string, unknown>;
};

const createSettingsRow = () => ({
  id: "settings::u-principal-ne",
  userId: "u-principal-ne",
  version: 1,
  profile: {
    displayName: "Nina Principal",
    email: "nina.principal@bufsd.org",
    bio: "",
    timezone: "America/New_York",
    avatarUrl: null,
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: false,
    digestFrequency: "Daily",
    alerts: {
      newMessageReceived: true,
      mtssMeetingScheduled: true,
      interventionPlanGoalMet: true,
      studentFlaggedAtRisk: true,
    },
  },
  security: {
    twoFactorEnabled: true,
    providerManagedAuth: true,
    lastPasswordChangedAt: null,
  },
  preferences: {
    preferredLanguage: "English",
    contactMethodPriority: "Email first, then Phone",
  },
  classroom: {
    autoFlagLowAttendance: true,
    weeklyParentSummary: true,
  },
  system: {
    infiniteCampusConnected: true,
    cleverConnected: true,
    powerSchoolConnected: false,
    eSchoolDataConnected: false,
  },
  updatedAt: "2026-02-17T15:30:00.000Z",
  updatedBy: "u-principal-ne",
});

const createJsonResponse = ({ status, body }: MockResponseConfig): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const waitFor = async (assertion: () => void, timeoutMs = 1500) => {
  const start = Date.now();
  let lastError: unknown = null;
  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  throw lastError;
};

const setupView = async (responseConfig: MockResponseConfig) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const fetchMock = vi.fn(async () => createJsonResponse(responseConfig));
  vi.stubGlobal("fetch", fetchMock);

  await act(async () => {
    root.render(
      React.createElement(SettingsView, {
        currentUserRole: UserRole.PRINCIPAL,
        currentUserName: "Nina Principal",
        currentSchoolName: "North Elementary",
      })
    );
  });

  await waitFor(() => {
    const title = container.querySelector("h1");
    expect(title?.textContent).toContain("Manage your workspace preferences");
  });

  return { container, root, fetchMock };
};

const cleanupView = async (root: Root, container: HTMLElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("SettingsView UI behaviors", () => {
  it("asks for confirmation before leaving a dirty section", async () => {
    const { container, root } = await setupView({
      status: 200,
      body: { ok: true, rows: [createSettingsRow()], total: 1, requestId: "req-settings" },
    });

    const notificationsTab = container.querySelector("#settings-tab-notifications");
    expect(notificationsTab).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      (notificationsTab as HTMLButtonElement).click();
    });

    await waitFor(() => {
      expect(container.querySelector("#settings-tab-notifications")?.getAttribute("aria-selected")).toBe("true");
    });

    const toggleInput = container.querySelector('input[type="checkbox"]');
    expect(toggleInput).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      (toggleInput as HTMLInputElement).click();
    });

    await waitFor(() => {
      expect((toggleInput as HTMLInputElement).checked).toBe(false);
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const securityTab = container.querySelector("#settings-tab-security");
    expect(securityTab).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      (securityTab as HTMLButtonElement).click();
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelector("#settings-tab-notifications")?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector("#settings-tab-security")?.getAttribute("aria-selected")).toBe("false");

    confirmSpy.mockReturnValue(true);
    await act(async () => {
      (securityTab as HTMLButtonElement).click();
    });

    expect(container.querySelector("#settings-tab-security")?.getAttribute("aria-selected")).toBe("true");
    await cleanupView(root, container);
  });

  it("locks editing controls when settings load is unauthorized", async () => {
    const { container, root } = await setupView({
      status: 401,
      body: { ok: false, error: "Unauthorized.", requestId: "req-unauthorized" },
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Session expired. Sign in again to continue editing settings.");
    });

    const displayNameInput = container.querySelector("#profile-display-name");
    expect(displayNameInput).toBeInstanceOf(HTMLInputElement);
    expect((displayNameInput as HTMLInputElement).matches(":disabled")).toBe(true);

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Save")
    );
    expect(saveButton).toBeDefined();
    expect(saveButton?.hasAttribute("disabled")).toBe(true);

    const signInAgainLink = container.querySelector('a[href="/api/auth/login?returnTo=/app/settings"]');
    expect(signInAgainLink).toBeInstanceOf(HTMLAnchorElement);

    await cleanupView(root, container);
  });
});
