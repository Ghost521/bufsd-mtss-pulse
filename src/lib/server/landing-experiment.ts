import {
  LANDING_COPY_EXPERIMENT_ID,
  LANDING_COPY_VARIANT_COOKIE,
  LANDING_COPY_VARIANT_TTL_SECONDS,
  type LandingCopyVariant,
  getVariantFromSearch,
  isLandingCopyVariant,
  pickRandomLandingVariant,
} from "../landing-experiment";
import { parseCookieHeader, serializeCookie } from "./cookies";

const COOKIE_SECURE = process.env.NODE_ENV === "production";

export type LandingVariantResolutionSource = "cookie" | "random" | "query_override";

export type LandingVariantResolution = {
  experimentId: typeof LANDING_COPY_EXPERIMENT_ID;
  variant: LandingCopyVariant;
  source: LandingVariantResolutionSource;
  setCookie?: string;
};

export const readLandingVariantCookie = (cookieHeader: string | null): LandingCopyVariant | null => {
  const cookies = parseCookieHeader(cookieHeader);
  const value = cookies[LANDING_COPY_VARIANT_COOKIE];
  return isLandingCopyVariant(value) ? value : null;
};

export const serializeLandingVariantCookie = (variant: LandingCopyVariant): string =>
  serializeCookie(LANDING_COPY_VARIANT_COOKIE, variant, {
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: COOKIE_SECURE,
    maxAge: LANDING_COPY_VARIANT_TTL_SECONDS,
  });

export const resolveLandingVariant = (
  request: Request,
  random: () => number = Math.random
): LandingVariantResolution => {
  const url = new URL(request.url);
  const queryVariant = getVariantFromSearch(url.search);
  if (queryVariant) {
    return {
      experimentId: LANDING_COPY_EXPERIMENT_ID,
      variant: queryVariant,
      source: "query_override",
    };
  }

  const cookieVariant = readLandingVariantCookie(request.headers.get("cookie"));
  if (cookieVariant) {
    return {
      experimentId: LANDING_COPY_EXPERIMENT_ID,
      variant: cookieVariant,
      source: "cookie",
    };
  }

  const assigned = pickRandomLandingVariant(random);
  return {
    experimentId: LANDING_COPY_EXPERIMENT_ID,
    variant: assigned,
    source: "random",
    setCookie: serializeLandingVariantCookie(assigned),
  };
};

