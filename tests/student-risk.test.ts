import { describe, expect, it } from "vitest";
import { Tier } from "../src/types";
import {
  getAttendanceTone,
  getGpaTone,
  getReadingTone,
  getTierTone,
  riskToneLabel,
} from "../src/lib/student-risk";

describe("student risk helpers", () => {
  it("maps tier to expected tones", () => {
    expect(getTierTone(Tier.TIER_1)).toBe("good");
    expect(getTierTone(Tier.TIER_2)).toBe("warn");
    expect(getTierTone(Tier.TIER_3)).toBe("risk");
  });

  it("maps attendance thresholds to tones", () => {
    expect(getAttendanceTone(95)).toBe("good");
    expect(getAttendanceTone(94)).toBe("warn");
    expect(getAttendanceTone(90)).toBe("warn");
    expect(getAttendanceTone(89)).toBe("risk");
  });

  it("maps gpa thresholds to tones", () => {
    expect(getGpaTone("3.0")).toBe("good");
    expect(getGpaTone("2.99")).toBe("warn");
    expect(getGpaTone("2.0")).toBe("warn");
    expect(getGpaTone("1.9")).toBe("risk");
    expect(getGpaTone("not-a-number")).toBe("neutral");
  });

  it("maps reading levels to tones", () => {
    expect(getReadingTone("A")).toBe("risk");
    expect(getReadingTone("L")).toBe("risk");
    expect(getReadingTone("M")).toBe("warn");
    expect(getReadingTone("Q")).toBe("warn");
    expect(getReadingTone("R")).toBe("good");
    expect(getReadingTone("z")).toBe("good");
    expect(getReadingTone("")).toBe("neutral");
  });

  it("maps tones to consistent labels", () => {
    expect(riskToneLabel("good")).toBe("On track");
    expect(riskToneLabel("warn")).toBe("Watch");
    expect(riskToneLabel("risk")).toBe("Urgent");
    expect(riskToneLabel("neutral")).toBe("No data");
  });
});
