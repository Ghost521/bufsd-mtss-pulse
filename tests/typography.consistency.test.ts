import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), "utf8");

const collectComponentFiles = (relativeDir: string): string[] => {
  const absoluteDir = resolve(ROOT, relativeDir);
  const entries = readdirSync(absoluteDir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(absoluteDir, entry);
    const relativePath = `${relativeDir}/${entry}`.replace(/\\/g, "/");
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...collectComponentFiles(relativePath));
      continue;
    }
    if (relativePath.endsWith(".tsx") || relativePath.endsWith(".ts")) {
      files.push(relativePath);
    }
  }

  return files;
};

describe("typography consistency", () => {
  it("does not use monospace or serif utility classes in component source", () => {
    const files = collectComponentFiles("src/components");

    for (const filePath of files) {
      const source = readSource(filePath);
      expect(source.includes("font-mono")).toBe(false);
      expect(source.includes("font-serif")).toBe(false);
    }
  });

  it("applies heading font globally via font-heading token", () => {
    const source = readSource("src/styles.css");

    expect(source).toContain("h1,");
    expect(source).toContain("h6,");
    expect(source).toContain("[role=\"heading\"]");
    expect(source).toContain("font-family: var(--font-heading);");
  });

  it("keeps body typography defaulted to Manrope token", () => {
    const source = readSource("src/styles.css");

    expect(source).toContain("html {");
    expect(source).toContain("font-family: var(--font-sans);");
    expect(source).toContain("body {");
    expect(source).toContain("font-family: inherit;");
  });
});
