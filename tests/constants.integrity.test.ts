import { describe, expect, it } from "vitest";
import { DISTRICT_SCHOOLS, MOCK_CALENDAR_EVENTS } from "../src/constants";

describe("constants integrity", () => {
  it("uses unique district school ids", () => {
    const ids = DISTRICT_SCHOOLS.map((school) => school.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps calendar event start <= end", () => {
    for (const event of MOCK_CALENDAR_EVENTS) {
      expect(new Date(event.start).getTime()).toBeLessThanOrEqual(new Date(event.end).getTime());
    }
  });
});
