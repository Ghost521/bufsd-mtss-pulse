// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../src/components/Sidebar";
import { UserRole } from "../src/types";

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

const baseProps: React.ComponentProps<typeof Sidebar> = {
  currentRole: UserRole.PRINCIPAL,
  availableRoles: [UserRole.PRINCIPAL, UserRole.TEACHER],
  onRoleChange: vi.fn(),
  userName: "Nina Principal",
  userAvatarUrl: null,
  schoolName: "North Elementary",
  isMobileOpen: false,
  onMobileClose: vi.fn(),
  activePage: "dashboard" as const,
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
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("Sidebar containment safeguards", () => {
  it("keeps desktop sidebar content constrained to panel width", async () => {
    const handle = await renderSidebar({ isDesktopCollapsed: false });

    const desktopAside = handle.container.querySelector("aside.fixed.inset-y-0.left-0.z-30");
    expect(desktopAside).toBeInstanceOf(HTMLElement);
    expect((desktopAside as HTMLElement).className).toContain("overflow-hidden");

    const contentWrapper = desktopAside?.firstElementChild as HTMLElement | null;
    expect(contentWrapper).toBeInstanceOf(HTMLElement);
    expect(contentWrapper?.className).toContain("w-full");
    expect(contentWrapper?.className).toContain("min-w-0");
    expect(contentWrapper?.className).toContain("overflow-hidden");
    expect(handle.container.textContent).toContain("Nina Principal");
    expect(handle.container.textContent).toContain("Workspace");
    expect(handle.container.textContent).not.toContain("Your role view");
    expect(handle.container.textContent).not.toContain("Account & Workspace");
    expect(handle.container.textContent).toContain("NP");
    expect(handle.container.textContent).not.toContain("Open");

    await cleanupRender(handle);
  });

  it("renders profile image when a sidebar avatar URL is provided", async () => {
    const avatarUrl = "https://example.com/avatar.png";
    const handle = await renderSidebar({ isDesktopCollapsed: false, userAvatarUrl: avatarUrl });

    const avatarImage = handle.container.querySelector('img[alt="Profile photo for Nina Principal"]') as HTMLImageElement | null;
    expect(avatarImage).toBeInstanceOf(HTMLImageElement);
    expect(avatarImage?.src).toContain(avatarUrl);

    await cleanupRender(handle);
  });

  it("uses collapsed controls that avoid top-row overflow pressure", async () => {
    const onDesktopCollapseToggle = vi.fn();
    const handle = await renderSidebar({ isDesktopCollapsed: true, onDesktopCollapseToggle });

    const desktopAside = handle.container.querySelector("aside.fixed.inset-y-0.left-0.z-30");
    expect(desktopAside).toBeInstanceOf(HTMLElement);
    expect((desktopAside as HTMLElement).className).toContain("overflow-hidden");

    const collapsedExpandControl = handle.container.querySelector(
      'button[aria-label="Show profile and settings"]'
    );
    expect(collapsedExpandControl).toBeInstanceOf(HTMLButtonElement);

    const topExpandButton = handle.container.querySelector('button[aria-label="Expand sidebar"]') as HTMLElement | null;
    expect(topExpandButton).toBeInstanceOf(HTMLButtonElement);
    expect(topExpandButton?.className).toContain("rounded-md");
    expect(topExpandButton?.className).toContain("lg:inline-flex");

    await act(async () => {
      topExpandButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onDesktopCollapseToggle).toHaveBeenCalledTimes(1);

    await cleanupRender(handle);
  });
});
