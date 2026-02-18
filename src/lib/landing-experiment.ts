export const LANDING_COPY_EXPERIMENT_ID = "landing_copy_v1" as const;
export const LANDING_COPY_VARIANT_COOKIE = "mtss_exp_landing_copy_v1" as const;
export const LANDING_COPY_VARIANT_QUERY_PARAM = "lp_variant" as const;
export const LANDING_COPY_VARIANT_TTL_SECONDS = 60 * 60 * 24 * 30;

export const landingCopyVariants = ["control", "district"] as const;
export type LandingCopyVariant = (typeof landingCopyVariants)[number];

export const isLandingCopyVariant = (value: string | null | undefined): value is LandingCopyVariant =>
  value === "control" || value === "district";

export const getVariantFromSearch = (search: string): LandingCopyVariant | null => {
  if (!search) return null;
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const value = params.get(LANDING_COPY_VARIANT_QUERY_PARAM);
    return isLandingCopyVariant(value) ? value : null;
  } catch {
    return null;
  }
};

export const pickRandomLandingVariant = (random: () => number = Math.random): LandingCopyVariant =>
  random() < 0.5 ? "control" : "district";

