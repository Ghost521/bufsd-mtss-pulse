import { z } from "zod";

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex color (example: #047857).")
  .transform((value) => value.toLowerCase());

export const brandingColorTokensSchema = z.object({
  primary: hexColorSchema,
  secondary: hexColorSchema,
  accent: hexColorSchema,
  surface: hexColorSchema,
});

export const districtBrandingEditableSchema = z.object({
  mascotName: z.string().trim().min(2, "Mascot name must be at least 2 characters.").max(80),
  logoUrl: z.string().max(2_000_000).nullable(),
  colors: brandingColorTokensSchema,
});

export const districtBrandingRecordSchema = districtBrandingEditableSchema.extend({
  id: z.string().min(1),
  version: z.literal(1),
  organizationId: z.string().min(1),
  districtId: z.string().min(1).nullable(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().min(1),
});

export type BrandingColorTokens = z.infer<typeof brandingColorTokensSchema>;
export type DistrictBrandingEditable = z.infer<typeof districtBrandingEditableSchema>;
export type DistrictBrandingRecord = z.infer<typeof districtBrandingRecordSchema>;

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
