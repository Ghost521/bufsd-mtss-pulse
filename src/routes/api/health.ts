import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          ok: true,
          timestamp: new Date().toISOString(),
          environment: "start-server-route" as const,
        });
      },
    },
  },
});
