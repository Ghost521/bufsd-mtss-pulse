import { describe, expect, it } from "vitest";
import { LANDING_COPY } from "../src/lib/landing-copy";

describe("landing copy consistency", () => {
  it("uses MTSS Pulse as the canonical brand across variants", () => {
    expect(LANDING_COPY.control.brandName).toBe("MTSS Pulse");
    expect(LANDING_COPY.district.brandName).toBe("MTSS Pulse");
  });

  it("uses the revised top-nav labels for both variants", () => {
    expect(LANDING_COPY.control.nav.features).toBe("Overview");
    expect(LANDING_COPY.control.nav.support).toBe("Capabilities");
    expect(LANDING_COPY.control.nav.howItWorks).toBe("How It Works");
    expect(LANDING_COPY.district.nav.features).toBe("Overview");
    expect(LANDING_COPY.district.nav.support).toBe("Capabilities");
    expect(LANDING_COPY.district.nav.howItWorks).toBe("How It Works");
  });

  it("defines a 3-step workflow and one footer CTA for both variants", () => {
    expect(LANDING_COPY.control.finalCta.steps).toHaveLength(3);
    expect(LANDING_COPY.control.footer.submitCta).toBe("Open Workspace");
    expect(LANDING_COPY.district.finalCta.steps).toHaveLength(3);
    expect(LANDING_COPY.district.footer.submitCta).toBe("Open Workspace");
  });
});
