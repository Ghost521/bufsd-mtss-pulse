import { describe, expect, it } from "vitest";
import { LANDING_COPY_EXPERIMENT_ID } from "../src/lib/landing-experiment";
import { landingExperimentEventSchema } from "../src/lib/schemas/landing-experiments";

describe("landing experiment event schema", () => {
  it("accepts valid tracking payloads", () => {
    const payload = {
      experimentId: LANDING_COPY_EXPERIMENT_ID,
      variant: "district",
      event: "cta_primary_click",
      section: "hero",
      href: "/api/auth/login?returnTo=/app",
      timestamp: new Date().toISOString(),
    };

    const parsed = landingExperimentEventSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid variants and event names", () => {
    const parsed = landingExperimentEventSchema.safeParse({
      experimentId: LANDING_COPY_EXPERIMENT_ID,
      variant: "alpha",
      event: "click",
      section: "hero",
    });
    expect(parsed.success).toBe(false);
  });
});

