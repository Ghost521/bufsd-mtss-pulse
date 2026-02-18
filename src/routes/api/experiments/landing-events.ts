import { createFileRoute } from "@tanstack/react-router";
import { newRequestId } from "../../../lib/server/audit-log";
import { landingExperimentEventSchema } from "../../../lib/schemas/landing-experiments";
import { appendLandingExperimentEvent, getLandingExperimentEventCount } from "../../../lib/server/landing-experiment-store";

const parseBody = async (request: Request): Promise<unknown | null> =>
  request
    .json()
    .then((value) => value as unknown)
    .catch(() => null);

export const Route = createFileRoute("/api/experiments/landing-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = newRequestId();
        const body = await parseBody(request);
        const parsed = landingExperimentEventSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            {
              ok: false,
              requestId,
              error: parsed.error.issues[0]?.message ?? "Invalid event payload.",
            },
            { status: 400 }
          );
        }

        appendLandingExperimentEvent(parsed.data, request);
        return Response.json({ ok: true, requestId });
      },
      GET: async () =>
        Response.json({
          ok: true,
          total: getLandingExperimentEventCount(),
        }),
    },
  },
});

