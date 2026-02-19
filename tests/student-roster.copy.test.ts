import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const readSource = (relativePath: string): string => readFileSync(resolve(ROOT, relativePath), "utf8");

describe("student roster copy consistency", () => {
  it("uses concise, action-oriented roster language", () => {
    const source = readSource("src/components/StudentRosterView.tsx");

    expect(source).toContain("Needs review");
    expect(source).toContain("Schoolwide student roster");
    expect(source).toContain("Class roster");
    expect(source).toContain("Create referral");
    expect(source).toContain("Add student");
    expect(source).toContain("Take attendance");
    expect(source).toContain("Save attendance");
    expect(source).toContain("View details");
    expect(source).toContain("No students found for these filters.");
    expect(source).toContain("Search by name, ID, or teacher");
    expect(source).toContain("Total students");
    expect(source).toContain("Avg attendance");
    expect(source).toContain("Avg GPA");

    expect(source).not.toContain("School-wide monitored roster");
    expect(source).not.toContain("Classroom roster");
    expect(source).not.toContain("Bulk select");
    expect(source).not.toContain("Open profile");
    expect(source).not.toContain(">Open<");
    expect(source).not.toContain("Mark all present");
    expect(source).not.toContain("Mark all late");
    expect(source).not.toContain("Mark all absent");
    expect(source).not.toContain("No students match current filters.");
  });

  it("uses tighter roster shell framing copy", () => {
    const source = readSource("src/components/RosterView.tsx");

    expect(source).toContain("Roster workspace");
    expect(source).toContain("Manage staff and student rosters.");
    expect(source).toContain("Students");

    expect(source).not.toContain("Directory & Rosters");
    expect(source).not.toContain("Manage personnel and monitor student body progress.");
    expect(source).not.toContain("Student Body");
  });
});
