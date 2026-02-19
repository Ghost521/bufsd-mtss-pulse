// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferralModal } from "../src/components/ReferralModal";
import { Tier } from "../src/types";

type StudentRow = {
  id: string;
  name: string;
  grade: string;
  tier: Tier;
  gpa: string;
  attendance: number;
  readingLevel: string;
  activeInterventions: number;
  alerts: number;
  avatarSeed: string;
};

type StudentsState = {
  rows: StudentRow[];
  isLoading: boolean;
  error: Error | null;
};

let masterStudentsState: StudentsState = { rows: [], isLoading: false, error: null };
let classStudentsState: StudentsState = { rows: [], isLoading: false, error: null };
const masterRefetchMock = vi.fn(async () => undefined);
const classRefetchMock = vi.fn(async () => undefined);

type CreateCallbacks = {
  onSuccess?: (created: { id: string; status: "Pending Review"; routedTo: string }) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
};

let mutateBehavior: (payload: Record<string, unknown>, callbacks: CreateCallbacks) => void = (_payload, callbacks) => {
  callbacks.onSuccess?.({
    id: "RF-100001",
    status: "Pending Review",
    routedTo: "Principal Review Team",
  });
  callbacks.onSettled?.();
};
const createMutateSpy = vi.fn((payload: Record<string, unknown>, callbacks: CreateCallbacks) => {
  mutateBehavior(payload, callbacks);
});

vi.mock("../src/hooks/useStudents", () => ({
  useStudents: (scope: "master" | "class") => {
    const state = scope === "master" ? masterStudentsState : classStudentsState;
    const refetch = scope === "master" ? masterRefetchMock : classRefetchMock;
    return {
      studentsQuery: {
        data: { rows: state.rows, total: state.rows.length, scope },
        isLoading: state.isLoading,
        error: state.error,
        refetch,
      },
    };
  },
}));

vi.mock("../src/hooks/useTenantCollection", () => ({
  useTenantCollection: () => ({
    createMutation: {
      mutate: createMutateSpy,
    },
  }),
}));

vi.mock("../src/components/DraggableModal", async () => {
  const ReactModule = await import("react");
  return {
    DraggableModal: ({ isOpen, onClose, title, children, footer }: Record<string, unknown>) => {
      if (!isOpen) return null;
      return ReactModule.createElement("div", { role: "dialog" }, [
        ReactModule.createElement("button", { key: "modal-close", type: "button", onClick: onClose as () => void }, "Close Modal"),
        ReactModule.createElement("div", { key: "modal-title" }, title),
        ReactModule.createElement("div", { key: "modal-body" }, children),
        footer ? ReactModule.createElement("div", { key: "modal-footer" }, footer) : null,
      ]);
    },
  };
});

type RenderHandle = {
  container: HTMLElement;
  root: Root;
};

const baseStudents: StudentRow[] = [
  {
    id: "1001",
    name: "Ariana Diaz",
    grade: "4",
    tier: Tier.TIER_2,
    gpa: "3.4",
    attendance: 95,
    readingLevel: "4.2",
    activeInterventions: 1,
    alerts: 0,
    avatarSeed: "ariana-diaz",
  },
  {
    id: "1002",
    name: "Ben Ortiz",
    grade: "5",
    tier: Tier.TIER_1,
    gpa: "3.8",
    attendance: 97,
    readingLevel: "5.0",
    activeInterventions: 0,
    alerts: 0,
    avatarSeed: "ben-ortiz",
  },
];

const setStudentState = (overrides?: {
  master?: Partial<StudentsState>;
  classScope?: Partial<StudentsState>;
}) => {
  masterStudentsState = {
    rows: baseStudents,
    isLoading: false,
    error: null,
    ...overrides?.master,
  };
  classStudentsState = {
    rows: [],
    isLoading: false,
    error: null,
    ...overrides?.classScope,
  };
};

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const renderModal = async (
  props: Partial<React.ComponentProps<typeof ReferralModal>> = {}
): Promise<RenderHandle> => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      React.createElement(ReferralModal, {
        isOpen: true,
        onClose: vi.fn(),
        ...props,
      })
    );
  });
  await flush();
  return { container, root };
};

const cleanupRender = async ({ container, root }: RenderHandle) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

const setNativeValue = (
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
};

const fireInput = async (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  await act(async () => {
    setNativeValue(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
};

const fireKey = async (element: HTMLElement, key: string) => {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
};

const clickByText = async (container: HTMLElement, text: string) => {
  const target = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.trim() === text);
  expect(target).toBeInstanceOf(HTMLButtonElement);
  await act(async () => {
    target?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const selectStudentViaKeyboard = async (container: HTMLElement) => {
  const studentInput = container.querySelector("#referral-student-search") as HTMLInputElement | null;
  expect(studentInput).toBeInstanceOf(HTMLInputElement);
  await act(async () => {
    studentInput?.focus();
    studentInput?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  });
  await fireKey(studentInput as HTMLInputElement, "Home");
  await fireKey(studentInput as HTMLInputElement, "Enter");
};

const fillValidForm = async (container: HTMLElement) => {
  await selectStudentViaKeyboard(container);

  const category = container.querySelector("#referral-category") as HTMLSelectElement | null;
  expect(category).toBeInstanceOf(HTMLSelectElement);
  await fireInput(category as HTMLSelectElement, "Academic");

  const notes = container.querySelector("#referral-notes") as HTMLTextAreaElement | null;
  expect(notes).toBeInstanceOf(HTMLTextAreaElement);
  await fireInput(notes as HTMLTextAreaElement, "Student needs additional reading support.");
};

beforeEach(() => {
  setStudentState();
  masterRefetchMock.mockClear();
  classRefetchMock.mockClear();
  createMutateSpy.mockClear();
  sessionStorage.clear();
  mutateBehavior = (_payload, callbacks) => {
    callbacks.onSuccess?.({
      id: "RF-100001",
      status: "Pending Review",
      routedTo: "Principal Review Team",
    });
    callbacks.onSettled?.();
  };
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("ReferralModal UX improvements", () => {
  it("shows form-level submit errors without marking notes invalid", async () => {
    mutateBehavior = (_payload, callbacks) => {
      callbacks.onError?.(new Error("Server unavailable"));
      callbacks.onSettled?.();
    };

    const handle = await renderModal();
    await fillValidForm(handle.container);
    await clickByText(handle.container, "Submit Referral");

    expect(handle.container.textContent).toContain("Server unavailable");
    const notes = handle.container.querySelector("#referral-notes") as HTMLTextAreaElement | null;
    expect(notes?.getAttribute("aria-invalid")).toBe("false");
    expect(handle.container.textContent).not.toContain("Please provide a description.");

    await cleanupRender(handle);
  });

  it("submits referral payload without a client-generated id and keeps queue as primary success action", async () => {
    let submittedPayload: Record<string, unknown> | null = null;
    mutateBehavior = (payload, callbacks) => {
      submittedPayload = payload;
      callbacks.onSuccess?.({
        id: "RF-222222",
        status: "Pending Review",
        routedTo: "Principal Review Team",
      });
      callbacks.onSettled?.();
    };

    const onClose = vi.fn();
    const onViewQueue = vi.fn();
    const handle = await renderModal({ onClose, onViewQueue });
    await fillValidForm(handle.container);
    await clickByText(handle.container, "Submit Referral");

    expect(submittedPayload).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(submittedPayload ?? {}, "id")).toBe(false);
    expect(handle.container.textContent).toContain("RF-222222");

    const queueButton = Array.from(handle.container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("View Referral Queue")
    ) as HTMLButtonElement | undefined;
    expect(queueButton).toBeInstanceOf(HTMLButtonElement);
    expect(queueButton?.className).toContain("bg-indigo-600");

    await act(async () => {
      queueButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onViewQueue).toHaveBeenCalledWith("RF-222222");
    expect(onClose).toHaveBeenCalled();

    await cleanupRender(handle);
  });

  it("restores session draft and shows attachment reattach guidance", async () => {
    sessionStorage.setItem(
      "mtss:referralDraft:1001",
      JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        formData: {
          studentId: "1001",
          type: "Academic",
          urgency: "Low",
          notes: "Draft note from prior session.",
        },
        attachments: [
          {
            name: "evidence.pdf",
            size: 1000,
            lastModified: 1,
            type: "application/pdf",
          },
        ],
      })
    );

    const handle = await renderModal({ defaultStudentId: "1001" });
    expect(handle.container.textContent).toContain("Draft restored.");
    expect(handle.container.textContent).toContain("Reattach files before submitting.");

    const notes = handle.container.querySelector("#referral-notes") as HTMLTextAreaElement | null;
    expect(notes?.value).toBe("Draft note from prior session.");

    await cleanupRender(handle);
  });

  it("discards expired session drafts on open", async () => {
    const expiredDate = new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString();
    sessionStorage.setItem(
      "mtss:referralDraft:1001",
      JSON.stringify({
        version: 1,
        updatedAt: expiredDate,
        formData: {
          studentId: "1001",
          type: "Academic",
          urgency: "Low",
          notes: "Expired draft.",
        },
        attachments: [],
      })
    );

    const handle = await renderModal({ defaultStudentId: "1001" });
    expect(handle.container.textContent).not.toContain("Draft restored.");
    expect(sessionStorage.getItem("mtss:referralDraft:1001")).toBeNull();

    await cleanupRender(handle);
  });

  it("updates combobox active option with keyboard navigation", async () => {
    const handle = await renderModal();
    const input = handle.container.querySelector("#referral-student-search") as HTMLInputElement | null;
    expect(input).toBeInstanceOf(HTMLInputElement);

    await act(async () => {
      input?.focus();
      input?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    });
    await fireKey(input as HTMLInputElement, "End");
    expect(input?.getAttribute("aria-activedescendant")).toBe("referral-student-options-1002");

    await fireKey(input as HTMLInputElement, "Home");
    expect(input?.getAttribute("aria-activedescendant")).toBe("referral-student-options-1001");

    await cleanupRender(handle);
  });

  it("shows roster-unavailable state and retries student fetch", async () => {
    setStudentState({
      master: { rows: [], error: new Error("Master roster failed") },
      classScope: { rows: [], error: new Error("Class roster failed") },
    });

    const handle = await renderModal();
    const input = handle.container.querySelector("#referral-student-search") as HTMLInputElement | null;
    expect(input).toBeInstanceOf(HTMLInputElement);
    await act(async () => {
      input?.focus();
      input?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
    });

    expect(handle.container.textContent).toContain("Student roster is unavailable right now.");
    await clickByText(handle.container, "Retry loading roster");
    expect(masterRefetchMock).toHaveBeenCalled();
    expect(classRefetchMock).toHaveBeenCalled();

    await cleanupRender(handle);
  });
});
