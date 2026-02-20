import { describe, expect, it } from "vitest";
import {
  FP_LEVEL_ORDER,
  LEXILE_CONVERSION_ROWS,
  LEXILE_LEVEL_SUMMARIES,
  fpLevelToIndex,
  getLexileSummaryForFpLevel,
  getStageForFpLevel,
  normalizeFpLevel,
} from "../src/lib/lexile-conversion";

describe("lexile conversion lookup", () => {
  it("contains the full ordered conversion rows from 25L to 1200+L", () => {
    expect(LEXILE_CONVERSION_ROWS[0]).toMatchObject({
      lexileLabel: "25",
      fpLevel: "A",
      atosLabel: "0.2",
      stage: "Emergent",
    });
    expect(LEXILE_CONVERSION_ROWS.at(-1)).toMatchObject({
      lexileLabel: "1200+",
      fpLevel: "Z+",
      atosLabel: "7.0+",
      stage: "Advanced",
    });
    expect(LEXILE_CONVERSION_ROWS).toHaveLength(48);
  });

  it("normalizes and indexes F&P levels including Z+", () => {
    expect(normalizeFpLevel("level m")).toBe("M");
    expect(normalizeFpLevel("z+")).toBe("Z+");
    expect(normalizeFpLevel("")).toBeNull();
    expect(fpLevelToIndex("A")).toBe(1);
    expect(fpLevelToIndex("Z")).toBe(26);
    expect(fpLevelToIndex("Z+")).toBe(27);
    expect(FP_LEVEL_ORDER.at(-1)).toBe("Z+");
  });

  it("returns stage and range summaries by F&P level", () => {
    expect(getStageForFpLevel("B")).toBe("Emergent");
    expect(getStageForFpLevel("J")).toBe("Transitional");
    expect(getStageForFpLevel("Q")).toBe("Fluent");
    expect(getStageForFpLevel("Z+")).toBe("Advanced");

    expect(getLexileSummaryForFpLevel("M")).toMatchObject({
      fpLevel: "M",
      stage: "Transitional",
      lexileLabel: "450L - 475L",
      atosLabel: "3.2 - 3.5",
    });
    expect(getLexileSummaryForFpLevel("Z+")).toMatchObject({
      fpLevel: "Z+",
      stage: "Advanced",
      lexileLabel: "1200+L",
      atosLabel: "7.0+",
    });
    expect(LEXILE_LEVEL_SUMMARIES).toHaveLength(27);
  });
});

