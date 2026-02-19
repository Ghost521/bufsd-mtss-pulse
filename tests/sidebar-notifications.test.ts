// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../src/components/Sidebar";
import { UserRole, type NotificationListItem } from "../src/types";

vi.mock("@tanstack/react-router", async () => {
  const ReactModule = await import("react");
  return {
    Link: ({ to, className, onClick, children, activeOptions: _activeOptions, ...rest }: Record<string, unknown>) =>
      ReactModule.createElement(
        "a",
        {
          href: typeof to === "string" ? to : "#",
          className,
          onClick,
          ...rest,
        },
        children
      ),
    useNavigate: () => () => Promise.resolve(),
  };
});

type RenderHandle = {
  container: HTMLElement;
  root: Root;
};

const sampleNotification: NotificationListItem = {
  id: "n-1",
  recipientUserId: "u-principal-ne",
  recipientUserName: "Nina Principal",
  title: "2 unread messages",
  summary: "Mr. Davis sent an update.",
  body: "Please review this intervention note.",
  category: "Message",
  severity: "info",
  sourceType: "messages",
  sourceId: "conv-1",
  sourceFingerprint: "messages:conv-1:latest",
  sourceRoute: "messages",
  sourceContext: {},
  createdAt: "2026-02-19T12:00:00.000Z",
  updatedAt: "2026-02-19T12:00:00.000Z",
};

const readNotification: NotificationListItem = {
  ...sampleNotification,
  id: "n-2",
  title: "Reviewed intervention note",
  sourceFingerprint: "messages:conv-2:latest",
  readAt: "2026-02-19T12:05:00.000Z",
};

const baseProps: React.ComponentProps<typeof Sidebar> = {
  currentRole: UserRole.PRINCIPAL,
  availableRoles: [UserRole.PRINCIPAL],
  onRoleChange: vi.fn(),
  userName: "Nina Principal",
  schoolName: "North Elementary",
  isMobileOpen: false,
  onMobileClose: vi.fn(),
  activePage: "dashboard",
  isDesktopCollapsed: false,
  onDesktopCollapseToggle: vi.fn(),
  groupState: {
    work: true,
    planning: true,
    communication: true,
    administration: true,
  },
  onGroupToggle: vi.fn(),
  searchQuery: "",
  onSearchQueryChange: vi.fn(),
  notificationUnseenCount: 1,
  activeNotifications: [sampleNotification],
  archivedNotifications: [],
  onNotificationOpen: vi.fn(),
  onNotificationDismiss: vi.fn(),
  onNotificationArchive: vi.fn(),
  onNotificationDelete: vi.fn(),
  onNotificationRestore: vi.fn(),
  onNotificationMarkSeen: vi.fn(),
  onNotificationMarkAllRead: vi.fn(),
  onNotificationArchiveRead: vi.fn(),
};

const renderSidebar = async (overrides: Partial<typeof baseProps> = {}): Promise<RenderHandle> => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(Sidebar, { ...baseProps, ...overrides }));
  });

  return { container, root };
};

const cleanupRender = async ({ container, root }: RenderHandle) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("sidebar notifications", () => {
  it("shows Notifications in communication navigation", async () => {
    const handle = await renderSidebar();
    const navLink = Array.from(handle.container.querySelectorAll("a")).find(
      (anchor) => anchor.textContent?.trim() === "Notifications",
    );
    expect(navLink).toBeInstanceOf(HTMLAnchorElement);
    expect(navLink?.getAttribute("href")).toBe("/app/notifications");
    await cleanupRender(handle);
  });

  it("renders the notification bell with unread count", async () => {
    const handle = await renderSidebar();
    const bell = handle.container.querySelector('button[aria-label="Notifications (1 unread)"]');
    expect(bell).toBeInstanceOf(HTMLButtonElement);
    expect(handle.container.textContent).toContain("1");
    await cleanupRender(handle);
  });

  it("highlights unread notifications in the popover", async () => {
    const handle = await renderSidebar({
      activeNotifications: [sampleNotification, readNotification],
      notificationUnseenCount: 1,
    });
    const bell = handle.container.querySelector('button[aria-label="Notifications (1 unread)"]') as HTMLButtonElement | null;
    expect(bell).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      bell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const unreadRow = document.body.querySelector('[data-notification-id="n-1"]') as HTMLElement | null;
    const readRow = document.body.querySelector('[data-notification-id="n-2"]') as HTMLElement | null;

    expect(unreadRow).toBeInstanceOf(HTMLElement);
    expect(unreadRow?.getAttribute("data-unread")).toBe("true");
    expect(unreadRow?.className.includes("bg-brand-50/70")).toBe(true);
    expect(unreadRow?.querySelector('[data-unread-dot="true"]')).toBeInstanceOf(HTMLElement);

    expect(readRow).toBeInstanceOf(HTMLElement);
    expect(readRow?.getAttribute("data-unread")).toBe("false");
    expect(readRow?.className.includes("bg-white")).toBe(true);
    expect(readRow?.querySelector('[data-unread-dot="true"]')).toBe(null);

    await cleanupRender(handle);
  });

  it("supports bulk mark-all-read and archive-read actions", async () => {
    const onNotificationMarkAllRead = vi.fn();
    const onNotificationArchiveRead = vi.fn();
    const handle = await renderSidebar({
      activeNotifications: [sampleNotification, readNotification],
      notificationUnseenCount: 1,
      onNotificationMarkAllRead,
      onNotificationArchiveRead,
    });

    const bell = handle.container.querySelector('button[aria-label="Notifications (1 unread)"]') as HTMLButtonElement | null;
    expect(bell).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      bell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const markAllReadButton = document.body.querySelector("button");
    const buttons = Array.from(document.body.querySelectorAll("button")) as HTMLButtonElement[];
    const readAction = buttons.find((button) => button.textContent?.includes("Mark all read"));
    const archiveAction = buttons.find((button) => button.textContent?.includes("Archive read"));
    expect(markAllReadButton).toBeInstanceOf(HTMLButtonElement);
    expect(readAction).toBeInstanceOf(HTMLButtonElement);
    expect(archiveAction).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      readAction?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      archiveAction?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onNotificationMarkAllRead).toHaveBeenCalledTimes(1);
    expect(onNotificationArchiveRead).toHaveBeenCalledTimes(1);

    await cleanupRender(handle);
  });

  it("routes manage notifications CTA to the notifications inbox", async () => {
    const handle = await renderSidebar({
      activeNotifications: [sampleNotification, readNotification],
      notificationUnseenCount: 1,
    });
    const bell = handle.container.querySelector('button[aria-label="Notifications (1 unread)"]') as HTMLButtonElement | null;
    expect(bell).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      bell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const manageLink = Array.from(document.body.querySelectorAll("a")).find((anchor) =>
      anchor.textContent?.includes("Manage notifications"),
    );
    expect(manageLink).toBeInstanceOf(HTMLAnchorElement);
    expect(manageLink?.getAttribute("href")).toBe("/app/notifications");

    await cleanupRender(handle);
  });

  it("hides settings fallback CTA for unauthorized notification errors", async () => {
    const handle = await renderSidebar({
      notificationError: "Unauthorized.",
      notificationLoading: false,
    });
    const bell = handle.container.querySelector('button[aria-label="Notifications (1 unread)"]') as HTMLButtonElement | null;
    expect(bell).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      bell?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const signInLink = Array.from(document.body.querySelectorAll("a")).find((anchor) => anchor.textContent?.includes("Sign in again"));
    const manageLink = Array.from(document.body.querySelectorAll("a")).find((anchor) => anchor.textContent?.includes("Manage notifications"));
    expect(signInLink).toBeInstanceOf(HTMLAnchorElement);
    expect(manageLink).toBeUndefined();

    await cleanupRender(handle);
  });
});
