import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Gradebook actionable controls", () => {
  it("replaces placeholder alerts with modal-based workflows", () => {
    const source = readSource("src/components/GradebookView.tsx");

    expect(source).not.toContain('alert("Edit Assignment details")');
    expect(source).not.toContain('alert(`Sending bulk notification');
    expect(source).toContain("setShowEditAssignmentModal(true)");
    expect(source).toContain("setMissingModalMode('bulk')");
  });
});
