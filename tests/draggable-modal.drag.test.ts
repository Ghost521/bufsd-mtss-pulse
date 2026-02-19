// @vitest-environment jsdom

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DraggableModal } from "../src/components/DraggableModal";

type RenderHandle = {
  container: HTMLElement;
  root: Root;
};

const setWindowSize = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
    writable: true,
  });
};

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  }) as DOMRect;

const setModalRect = (dialog: HTMLElement, nextRect: DOMRect) => {
  Object.defineProperty(dialog, "getBoundingClientRect", {
    value: () => nextRect,
    configurable: true,
  });
};

const dispatchPointerEvent = async (
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: PointerEventInit & { pointerType?: string }
) => {
  await act(async () => {
    target.dispatchEvent(new window.PointerEvent(type, { bubbles: true, ...init }));
  });
};

const renderModal = async (
  props: Partial<React.ComponentProps<typeof DraggableModal>> = {}
): Promise<RenderHandle> => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(
        DraggableModal,
        {
          isOpen: true,
          onClose: vi.fn(),
          title: "Drag Test Modal",
          initialWidth: 400,
          initialHeight: 300,
          ...props,
        },
        React.createElement("div", null, "Modal content")
      )
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return { container, root };
};

const cleanupRender = async ({ container, root }: RenderHandle) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
      configurable: true,
    });
  }

  if (!("PointerEvent" in window)) {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;

      constructor(type: string, init: PointerEventInit & { pointerType?: string } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    (globalThis as { PointerEvent?: typeof PointerEvent }).PointerEvent =
      TestPointerEvent as unknown as typeof PointerEvent;
  }

  if (!("setPointerCapture" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      value: () => undefined,
      configurable: true,
    });
  }
  if (!("releasePointerCapture" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      value: () => undefined,
      configurable: true,
    });
  }
  if (!("hasPointerCapture" in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      value: () => false,
      configurable: true,
    });
  }
});

afterEach(() => {
  document.body.innerHTML = "";
  document.body.style.cursor = "";
  document.body.style.userSelect = "";
});

describe("DraggableModal pointer drag behavior", () => {
  it("drags and clamps to viewport bounds", async () => {
    setWindowSize(1000, 700);
    const handle = await renderModal();

    const dialog = handle.container.querySelector('[role="dialog"]') as HTMLDivElement | null;
    expect(dialog).toBeInstanceOf(HTMLDivElement);
    setModalRect(dialog as HTMLDivElement, rect(300, 200, 400, 300));

    const header = dialog?.firstElementChild as HTMLDivElement | null;
    expect(header).toBeInstanceOf(HTMLDivElement);

    await dispatchPointerEvent(header as HTMLDivElement, "pointerdown", {
      pointerId: 11,
      pointerType: "mouse",
      button: 0,
      clientX: 350,
      clientY: 240,
    });

    await dispatchPointerEvent(window, "pointermove", {
      pointerId: 11,
      pointerType: "mouse",
      button: 0,
      clientX: 980,
      clientY: 690,
    });

    expect((dialog as HTMLDivElement).style.transform).toBe("translate3d(600px, 400px, 0)");

    await dispatchPointerEvent(window, "pointerup", {
      pointerId: 11,
      pointerType: "mouse",
      button: 0,
      clientX: 980,
      clientY: 690,
    });

    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
    await cleanupRender(handle);
  });

  it("supports touch pointer drag interactions", async () => {
    setWindowSize(1200, 800);
    const handle = await renderModal({ initialWidth: 300, initialHeight: 200 });

    const dialog = handle.container.querySelector('[role="dialog"]') as HTMLDivElement | null;
    expect(dialog).toBeInstanceOf(HTMLDivElement);
    setModalRect(dialog as HTMLDivElement, rect(100, 100, 300, 200));

    const header = dialog?.firstElementChild as HTMLDivElement | null;
    expect(header).toBeInstanceOf(HTMLDivElement);

    await dispatchPointerEvent(header as HTMLDivElement, "pointerdown", {
      pointerId: 22,
      pointerType: "touch",
      clientX: 120,
      clientY: 130,
    });

    await dispatchPointerEvent(window, "pointermove", {
      pointerId: 22,
      pointerType: "touch",
      clientX: 250,
      clientY: 260,
    });

    expect((dialog as HTMLDivElement).style.transform).toBe("translate3d(230px, 230px, 0)");

    await dispatchPointerEvent(window, "pointerup", {
      pointerId: 22,
      pointerType: "touch",
      clientX: 250,
      clientY: 260,
    });

    await cleanupRender(handle);
  });

  it("resizes via pointer events on resize handle", async () => {
    setWindowSize(1400, 1000);
    const handle = await renderModal({ initialWidth: 400, initialHeight: 300 });

    const dialog = handle.container.querySelector('[role="dialog"]') as HTMLDivElement | null;
    expect(dialog).toBeInstanceOf(HTMLDivElement);
    setModalRect(dialog as HTMLDivElement, rect(200, 150, 400, 300));

    const resizeHandle = handle.container.querySelector(".cursor-nwse-resize") as HTMLDivElement | null;
    expect(resizeHandle).toBeInstanceOf(HTMLDivElement);

    await dispatchPointerEvent(resizeHandle as HTMLDivElement, "pointerdown", {
      pointerId: 33,
      pointerType: "mouse",
      button: 0,
      clientX: 600,
      clientY: 450,
    });

    await dispatchPointerEvent(window, "pointermove", {
      pointerId: 33,
      pointerType: "mouse",
      button: 0,
      clientX: 750,
      clientY: 600,
    });

    expect((dialog as HTMLDivElement).style.width).toBe("550px");
    expect((dialog as HTMLDivElement).style.height).toBe("450px");

    await dispatchPointerEvent(window, "pointerup", {
      pointerId: 33,
      pointerType: "mouse",
      button: 0,
      clientX: 750,
      clientY: 600,
    });

    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
    await cleanupRender(handle);
  });
});
