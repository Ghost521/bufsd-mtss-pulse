import { describe, expect, it } from "vitest";
import { LANDING_COPY } from "../src/lib/landing-copy";

describe("landing copy consistency", () => {
  it("uses MTSS Pulse as the canonical brand across variants", () => {
    expect(LANDING_COPY.control.brandName).toBe("MTSS Pulse");
    expect(LANDING_COPY.district.brandName).toBe("MTSS Pulse");
  });

  it("uses requested top-nav labels for both A/B variants", () => {
    expect(LANDING_COPY.control.nav.features).toBe("Features");
    expect(LANDING_COPY.control.nav.support).toBe("Results");
    expect(LANDING_COPY.control.nav.howItWorks).toBe("How It Works");
    expect(LANDING_COPY.district.nav.features).toBe("Capabilities");
    expect(LANDING_COPY.district.nav.support).toBe("District Results");
    expect(LANDING_COPY.district.nav.howItWorks).toBe("How It Works");
  });

  it("includes footer placeholder and CTA copy for both variants", () => {
    expect(LANDING_COPY.control.footer.emailPlaceholder).toBe("Work email");
    expect(LANDING_COPY.control.footer.submitCta).toBe("Request Invite");
    expect(LANDING_COPY.district.footer.emailPlaceholder).toBe("District work email");
    expect(LANDING_COPY.district.footer.submitCta).toBe("Request Walkthrough");
  });
});
