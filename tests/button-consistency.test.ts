import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buttonClassNames } from "../src/lib/ui/button";

const ROOT = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), "utf8");

const collectSourceFiles = (relativeDir: string): string[] => {
  const absoluteDir = resolve(ROOT, relativeDir);
  const entries = readdirSync(absoluteDir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(absoluteDir, entry);
    const relativePath = `${relativeDir}/${entry}`.replace(/\\/g, "/");
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(relativePath));
      continue;
    }

    if (relativePath.endsWith(".tsx") || relativePath.endsWith(".ts")) {
      files.push(relativePath);
    }
  }

  return files;
};

describe("button system consistency", () => {
  it("defines foundational design tokens and semantic button classes", () => {
    const source = readSource("src/styles.css");

    expect(source).toContain("--btn-font-weight-default");
    expect(source).toContain("--btn-primary-bg");
    expect(source).toContain(".btn {");
    expect(source).toContain(".btn-primary");
    expect(source).toContain(".btn-secondary");
    expect(source).toContain(".btn-ghost");
    expect(source).toContain(".btn-danger");
    expect(source).toContain(".btn-emphasis");
  });

  it("maps variant and size classes through buttonClassNames", () => {
    expect(buttonClassNames()).toContain("btn");
    expect(buttonClassNames()).toContain("btn-secondary");
    expect(buttonClassNames()).toContain("btn-md");
    expect(buttonClassNames({ variant: "primary", size: "lg", fullWidth: true })).toContain("btn-primary");
    expect(buttonClassNames({ variant: "primary", size: "lg", fullWidth: true })).toContain("btn-lg");
    expect(buttonClassNames({ variant: "primary", size: "lg", fullWidth: true })).toContain("btn-block");
    expect(buttonClassNames({ emphasis: true })).toContain("btn-emphasis");
  });

  it("keeps native button class strings at semibold weight by default", () => {
    const files = collectSourceFiles("src");

    for (const filePath of files) {
      const source = readSource(filePath);
      const buttonTags = source.match(/<button\b[\s\S]*?>/g) ?? [];

      for (const tag of buttonTags) {
        expect(tag.includes("font-bold")).toBe(false);
        expect(tag.includes("font-medium")).toBe(false);
      }
    }
  });
});

