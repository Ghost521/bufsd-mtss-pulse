import { createFileRoute } from "@tanstack/react-router";
import { newRequestId } from "../../../lib/server/audit-log";
import { resolveLandingVariant } from "../../../lib/server/landing-experiment";

export const Route = createFileRoute("/api/experiments/landing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const resolution = resolveLandingVariant(request);
        const response = Response.json(
          {
            ok: true,
            requestId,
            experimentId: resolution.experimentId,
            variant: resolution.variant,
            source: resolution.source,
          },
          { headers: { "cache-control": "no-store" } }
        );

        if (resolution.setCookie) {
          response.headers.append("Set-Cookie", resolution.setCookie);
        }

        return response;
      },
    },
  },
});

