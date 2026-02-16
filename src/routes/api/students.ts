import { createFileRoute } from "@tanstack/react-router";
import { CLASS_ROSTER_DATA, generateMasterRoster } from "../../constants";

export const Route = createFileRoute("/api/students")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const scope = url.searchParams.get("scope") ?? "class";

        const rows = scope === "master" ? generateMasterRoster() : CLASS_ROSTER_DATA;
        return Response.json({
          rows,
          total: rows.length,
          scope,
        });
      },
    },
  },
});
