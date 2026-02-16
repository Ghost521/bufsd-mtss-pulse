import { describe, expect, it } from "vitest";
import { normalizeActionItemPlan, normalizeImportAnalysisResult, safeJsonParse } from "../src/services/agents/jsonUtils";

describe("json utils", () => {
  it("parses fenced json safely", () => {
    const parsed = safeJsonParse<{ ok: boolean }>("```json\n{\"ok\": true}\n```", { ok: false });
    expect(parsed.ok).toBe(true);
  });

  it("normalizes import analysis fallback", () => {
    const normalized = normalizeImportAnalysisResult({ summary: "Done", anomalies: ["A"], recommendations: [1] });
    expect(normalized.summary).toBe("Done");
    expect(normalized.anomalies).toEqual(["A"]);
    expect(normalized.recommendations).toEqual([]);
  });

  it("normalizes action item plan fallback", () => {
    expect(normalizeActionItemPlan({ title: "t", notes: "n" })).toEqual({ title: "t", notes: "n" });
    expect(normalizeActionItemPlan({})).toEqual({ title: "Draft Plan", notes: "AI unavailable." });
  });
});
