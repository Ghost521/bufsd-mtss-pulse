import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Responsive layout containment guardrails", () => {
  it("keeps the app shell constrained to viewport width", () => {
    const source = readSource("src/components/App.tsx");

    expect(source).toContain("app-shell flex min-h-screen w-full min-w-0 overflow-x-hidden");
    expect(source).toContain("lg:max-w-[calc(100vw-16rem)]");
    expect(source).toContain("lg:max-w-[calc(100vw-5rem)]");
  });

  it("defines shared responsive utility classes", () => {
    const source = readSource("src/styles.css");

    expect(source).toContain(".app-responsive-pane");
    expect(source).toContain(".app-responsive-content");
    expect(source).toContain(".app-responsive-actions");
  });

  it("applies responsive pane/content safeguards to major dense views", () => {
    const files = [
      "src/components/DataImporter.tsx",
      "src/components/DocumentManager.tsx",
      "src/components/MessagesView.tsx",
      "src/components/InterventionManager.tsx",
      "src/components/CalendarView.tsx",
      "src/components/GradebookView.tsx",
    ];

    for (const filePath of files) {
      const source = readSource(filePath);
      expect(source.includes("app-responsive-pane") || source.includes("app-responsive-content")).toBe(true);
    }
  });

  it("keeps calendar week/day timeline min-width adaptive instead of fixed desktop-only widths", () => {
    const source = readSource("src/components/CalendarView.tsx");

    expect(source).toContain("min-w-[900px] lg:min-w-[1100px]");
    expect(source).toContain("min-w-[640px] md:min-w-[760px]");
  });
});
