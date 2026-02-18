import { createFileRoute } from "@tanstack/react-router";
import { newRequestId } from "../../lib/server/audit-log";
import { appendActivityCookie, getSessionAuthFailureReason, getSessionFromRequest } from "../../lib/server/auth-context";
import { requirePermission } from "../../lib/server/rbac";
import { deriveWorkspaceRole, getDashboardData } from "../../lib/server/dashboard-store";

export const Route = createFileRoute("/api/dashboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        const permission = requirePermission(session, { resource: "dashboard", action: "read" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const url = new URL(request.url);
        const role = deriveWorkspaceRole(session, url.searchParams.get("role"));
        const data = await getDashboardData(session, role);
        return appendActivityCookie(Response.json({ ok: true, data, requestId }));
      },
    },
  },
});
