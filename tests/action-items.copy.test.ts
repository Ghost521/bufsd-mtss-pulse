// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionItemsList } from "../src/components/ActionItemsList";
import type { ActionItem } from "../src/types";

const items: ActionItem[] = [
  {
    id: "ai-1",
    studentName: "Avery Johnson",
    grade: "4",
    category: "Academic",
    insight: "Reading fluency dropped two checkpoints in a row.",
    isAiDetected: true,
  },
];

type RenderHandle = {
  container: HTMLElement;
  root: Root;
};

const renderList = async (): Promise<RenderHandle> => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  }));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(ActionItemsList, {
        items,
        onStudentClick: vi.fn(),
        onViewAll: vi.fn(),
        totalCount: items.length,
      })
    );
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
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Action items copy", () => {
  it("uses tightened case-oriented wording", async () => {
    const handle = await renderList();
    const text = handle.container.textContent ?? "";

    expect(text).toContain("Priority Support Queue");
    expect(text).toContain("1 case ready for triage.");
    expect(text).toContain("View all cases in reports (1)");

    expect(text).not.toContain("Priority Support Actions");
    expect(text).not.toContain("student cases ready for team review");
    expect(text).not.toContain("flagged student cases");

    await cleanupRender(handle);
  });
});
