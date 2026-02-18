import { z } from "zod";
import { LANDING_COPY_EXPERIMENT_ID, landingCopyVariants } from "../landing-experiment";

export const landingExperimentEventNames = [
  "impression",
  "cta_primary_click",
  "cta_secondary_click",
  "cta_header_demo_click",
  "cta_footer_submit_click",
] as const;

export const landingExperimentSections = ["hero", "header", "final", "footer"] as const;

export const landingExperimentEventSchema = z.object({
  experimentId: z.literal(LANDING_COPY_EXPERIMENT_ID),
  variant: z.enum(landingCopyVariants),
  event: z.enum(landingExperimentEventNames),
  section: z.enum(landingExperimentSections),
  href: z.string().trim().max(2_000).optional(),
  timestamp: z.string().datetime().optional(),
});

export type LandingExperimentEventName = (typeof landingExperimentEventNames)[number];
export type LandingExperimentSection = (typeof landingExperimentSections)[number];
export type LandingExperimentEventPayload = z.infer<typeof landingExperimentEventSchema>;

