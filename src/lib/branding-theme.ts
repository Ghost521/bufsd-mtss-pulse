import { DEFAULT_DISTRICT_BRANDING, type DistrictBrandingEditable } from "./schemas/branding";

const FALLBACK_BRANDING = DEFAULT_DISTRICT_BRANDING;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const clampChannel = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex: string): [number, number, number] => {
  const sanitized = hex.trim().replace(/^#/, "");
  const normalized = sanitized.length === 3
    ? sanitized
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : sanitized;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return [4, 120, 87];
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
};

const rgbToHex = (rgb: [number, number, number]): string =>
  `#${rgb
    .map((channel) => clampChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;

const mixHex = (baseHex: string, targetHex: string, targetWeight: number): string => {
  const weight = Math.max(0, Math.min(1, targetWeight));
  const [r1, g1, b1] = hexToRgb(baseHex);
  const [r2, g2, b2] = hexToRgb(targetHex);

  return rgbToHex([
    r1 + (r2 - r1) * weight,
    g1 + (g2 - g1) * weight,
    b1 + (b2 - b1) * weight,
  ] as [number, number, number]);
};

const setCssVar = (name: string, value: string): void => {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(name, value);
};

const normalizeColor = (value: string | undefined, fallback: string): string =>
  typeof value === "string" && HEX_COLOR_PATTERN.test(value.trim()) ? value.trim().toLowerCase() : fallback;

const buildPrimaryScale = (primary: string): Record<string, string> => ({
  "50": mixHex(primary, "#ffffff", 0.92),
  "100": mixHex(primary, "#ffffff", 0.84),
  "200": mixHex(primary, "#ffffff", 0.68),
  "300": mixHex(primary, "#ffffff", 0.48),
  "400": mixHex(primary, "#ffffff", 0.28),
  "500": mixHex(primary, "#ffffff", 0.14),
  "600": primary,
  "700": mixHex(primary, "#000000", 0.14),
  "800": mixHex(primary, "#000000", 0.28),
  "900": mixHex(primary, "#000000", 0.44),
  "950": mixHex(primary, "#000000", 0.58),
});

export const resolveBrandingTheme = (candidate: Partial<DistrictBrandingEditable> | null | undefined): DistrictBrandingEditable => ({
  mascotName: candidate?.mascotName?.trim() || FALLBACK_BRANDING.mascotName,
  logoUrl:
    typeof candidate?.logoUrl === "string" && candidate.logoUrl.trim().length > 0
      ? candidate.logoUrl
      : null,
  colors: {
    primary: normalizeColor(candidate?.colors?.primary, FALLBACK_BRANDING.colors.primary),
    secondary: normalizeColor(candidate?.colors?.secondary, FALLBACK_BRANDING.colors.secondary),
    accent: normalizeColor(candidate?.colors?.accent, FALLBACK_BRANDING.colors.accent),
    surface: normalizeColor(candidate?.colors?.surface, FALLBACK_BRANDING.colors.surface),
  },
});

export const applyTenantBrandingTheme = (candidate: Partial<DistrictBrandingEditable> | null | undefined): DistrictBrandingEditable => {
  const theme = resolveBrandingTheme(candidate);
  const primaryScale = buildPrimaryScale(theme.colors.primary);

  setCssVar("--tenant-color-primary", theme.colors.primary);
  setCssVar("--tenant-color-secondary", theme.colors.secondary);
  setCssVar("--tenant-color-accent", theme.colors.accent);
  setCssVar("--tenant-color-surface", theme.colors.surface);

  for (const [level, color] of Object.entries(primaryScale)) {
    setCssVar(`--color-brand-${level}`, color);
    setCssVar(`--color-indigo-${level}`, color);
  }

  setCssVar("--color-surface-canvas", theme.colors.surface);
  setCssVar("--color-surface-subtle", mixHex(theme.colors.surface, "#ffffff", 0.35));
  setCssVar("--color-surface-panel", mixHex(theme.colors.surface, "#ffffff", 0.82));
  setCssVar("--app-focus-ring", theme.colors.primary);

  const [r, g, b] = hexToRgb(theme.colors.primary);
  setCssVar("--app-focus-shadow", `rgba(${r}, ${g}, ${b}, 0.28)`);

  return theme;
};
