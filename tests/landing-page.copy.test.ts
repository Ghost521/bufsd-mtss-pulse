// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "../src/components/LandingPage";

const navigateMock = vi.fn(() => Promise.resolve());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

type RenderHandle = {
  container: HTMLElement;
  root: Root;
};

const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const renderLandingPage = async (): Promise<RenderHandle> => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(React.createElement(LandingPage));
  });
  await flushEffects();
  return { container, root };
};

const cleanupRender = async ({ container, root }: RenderHandle) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  navigateMock.mockClear();
  document.body.innerHTML = "";
});

describe("Landing copy trust guardrails", () => {
  it("renders updated WorkOS helper text and footer email placeholder copy", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : String(input);

      if (url.includes("/api/health")) {
        return new Response(
          JSON.stringify({
            ok: true,
            auth: {
              signedIn: false,
              workosEnabled: true,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (url.includes("/api/experiments/landing-events")) {
        return new Response(null, { status: 202 });
      }

      if (url.includes("/api/experiments/landing")) {
        return new Response(
          JSON.stringify({
            ok: true,
            experimentId: "landing_copy_v1",
            variant: "control",
            source: "cookie",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response("Not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const handle = await renderLandingPage();
    const text = handle.container.textContent ?? "";

    const emailInput = handle.container.querySelector('input[type="email"]') as HTMLInputElement | null;
    expect(emailInput).toBeInstanceOf(HTMLInputElement);
    expect(emailInput?.getAttribute("placeholder")).toBe("Work email");
    expect(text.split("Enterprise authentication and session security are powered by WorkOS.").length - 1).toBe(1);

    await cleanupRender(handle);
  });
});
