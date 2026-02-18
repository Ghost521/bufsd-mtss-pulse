import { describe, expect, it } from "vitest";
import { LANDING_COPY } from "../src/lib/landing-copy";

describe("landing copy consistency", () => {
  it("uses MTSS Pulse as the canonical brand across variants", () => {
    expect(LANDING_COPY.control.brandName).toBe("MTSS Pulse");
    expect(LANDING_COPY.district.brandName).toBe("MTSS Pulse");
  });

  it("aligns nav labels with real section intent", () => {
    expect(LANDING_COPY.control.nav.support).toBe("Capabilities");
    expect(LANDING_COPY.control.nav.howItWorks).toBe("Next Steps");
    expect(LANDING_COPY.district.nav.support).toBe("Capabilities");
    expect(LANDING_COPY.district.nav.howItWorks).toBe("Next Steps");
  });

  it("does not expose deprecated email placeholder copy", () => {
    expect("emailPlaceholder" in (LANDING_COPY.control.footer as Record<string, unknown>)).toBe(false);
    expect("emailPlaceholder" in (LANDING_COPY.district.footer as Record<string, unknown>)).toBe(false);
  });
});
