export type BrandingColorTokens = {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
};

export type DistrictBrandingEditable = {
  mascotName: string;
  logoUrl: string | null;
  colors: BrandingColorTokens;
};

export type DistrictBrandingRecord = DistrictBrandingEditable & {
  id: string;
  version: 1;
  organizationId: string;
  districtId: string | null;
  updatedAt: string;
  updatedBy: string;
};

export const DEFAULT_DISTRICT_BRANDING: DistrictBrandingEditable = {
  mascotName: "Panthers",
  logoUrl: null,
  colors: {
    primary: "#047857",
    secondary: "#0f766e",
    accent: "#ff8e73",
    surface: "#f4f7f9",
  },
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseHexColor = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
};

const parseMascotName = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= 2 && normalized.length <= 80 ? normalized : null;
};

const parseLogoUrl = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.length <= 2_000_000 ? value : undefined;
};

export const parseDistrictBrandingEditable = (value: unknown): DistrictBrandingEditable | null => {
  if (!isRecord(value)) return null;
  if (!isRecord(value.colors)) return null;

  const mascotName = parseMascotName(value.mascotName);
  const logoUrl = parseLogoUrl(value.logoUrl);
  const primary = parseHexColor(value.colors.primary);
  const secondary = parseHexColor(value.colors.secondary);
  const accent = parseHexColor(value.colors.accent);
  const surface = parseHexColor(value.colors.surface);

  if (!mascotName || logoUrl === undefined || !primary || !secondary || !accent || !surface) {
    return null;
  }

  return {
    mascotName,
    logoUrl,
    colors: {
      primary,
      secondary,
      accent,
      surface,
    },
  };
};

const parseNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseNullableNonEmptyString = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  return parseNonEmptyString(value) ?? undefined;
};

const parseTimestamp = (value: unknown): string | null => {
  const normalized = parseNonEmptyString(value);
  return normalized && !Number.isNaN(Date.parse(normalized)) ? normalized : null;
};

export const parseDistrictBrandingRecord = (value: unknown): DistrictBrandingRecord | null => {
  const editable = parseDistrictBrandingEditable(value);
  if (!editable || !isRecord(value)) return null;

  const id = parseNonEmptyString(value.id);
  const organizationId = parseNonEmptyString(value.organizationId);
  const districtId = parseNullableNonEmptyString(value.districtId);
  const updatedAt = parseTimestamp(value.updatedAt);
  const updatedBy = parseNonEmptyString(value.updatedBy);

  if (
    !id ||
    value.version !== 1 ||
    !organizationId ||
    districtId === undefined ||
    !updatedAt ||
    !updatedBy
  ) {
    return null;
  }

  return {
    ...editable,
    id,
    version: 1,
    organizationId,
    districtId,
    updatedAt,
    updatedBy,
  };
};

export const parseDistrictBrandingSnapshot = (raw: string | null | undefined): DistrictBrandingEditable | null => {
  if (!raw) return null;
  try {
    return parseDistrictBrandingEditable(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
};
