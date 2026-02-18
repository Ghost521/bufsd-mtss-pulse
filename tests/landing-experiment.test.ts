import { describe, expect, it } from "vitest";
import {
  LANDING_COPY_VARIANT_COOKIE,
  getVariantFromSearch,
  pickRandomLandingVariant,
} from "../src/lib/landing-experiment";
import { readLandingVariantCookie, resolveLandingVariant } from "../src/lib/server/landing-experiment";

describe("landing experiment helpers", () => {
  it("parses query overrides from search strings", () => {
    expect(getVariantFromSearch("?lp_variant=control")).toBe("control");
    expect(getVariantFromSearch("lp_variant=district")).toBe("district");
    expect(getVariantFromSearch("?lp_variant=unknown")).toBeNull();
  });

  it("chooses random variants from deterministic random inputs", () => {
    expect(pickRandomLandingVariant(() => 0.1)).toBe("control");
    expect(pickRandomLandingVariant(() => 0.9)).toBe("district");
  });

  it("reads valid variants from cookies", () => {
    const header = `${LANDING_COPY_VARIANT_COOKIE}=district; theme=light`;
    expect(readLandingVariantCookie(header)).toBe("district");
    expect(readLandingVariantCookie(`${LANDING_COPY_VARIANT_COOKIE}=invalid`)).toBeNull();
  });

  it("resolves query override ahead of cookie assignment", () => {
    const request = new Request("http://localhost:3000/?lp_variant=district", {
      headers: {
        cookie: `${LANDING_COPY_VARIANT_COOKIE}=control`,
      },
    });
    const result = resolveLandingVariant(request, () => 0.1);
    expect(result.variant).toBe("district");
    expect(result.source).toBe("query_override");
    expect(result.setCookie).toBeUndefined();
  });

  it("resolves cookie assignment before random assignment", () => {
    const request = new Request("http://localhost:3000/", {
      headers: {
        cookie: `${LANDING_COPY_VARIANT_COOKIE}=control`,
      },
    });
    const result = resolveLandingVariant(request, () => 0.9);
    expect(result.variant).toBe("control");
    expect(result.source).toBe("cookie");
    expect(result.setCookie).toBeUndefined();
  });

  it("assigns random variant and emits cookie when no assignment exists", () => {
    const request = new Request("http://localhost:3000/");
    const result = resolveLandingVariant(request, () => 0.9);
    expect(result.variant).toBe("district");
    expect(result.source).toBe("random");
    expect(result.setCookie).toContain(`${LANDING_COPY_VARIANT_COOKIE}=district`);
  });
});

