import { createFileRoute } from "@tanstack/react-router";
import { getSessionFromRequest, getSessionSummary, resolveSessionChange } from "../../lib/server/auth-context";
import { getAuditCount, newRequestId } from "../../lib/server/audit-log";
import { getPersistenceDiagnostics } from "../../lib/server/persistence";
import { getUsers } from "../../lib/server/tenant-store";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const session = getSessionFromRequest(request);
        const summary = getSessionSummary(session);
        const auditCount = session ? await getAuditCount(session.activeContext) : 0;

        return Response.json({
          ok: true,
          timestamp: new Date().toISOString(),
          environment: "start-server-route" as const,
          requestId,
          session: summary,
          authConfigured: true,
          availableUsers: getUsers().map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            primaryRole: user.primaryRole,
          })),
          auditCount,
          persistence: getPersistenceDiagnostics(),
        });
      },
      POST: async ({ request }) => {
        const requestId = newRequestId();
        const body = (await request.json().catch(() => null)) as unknown;
        const changed = resolveSessionChange(request, body);
        if ("error" in changed) {
          return Response.json({ ok: false, error: changed.error, requestId }, { status: changed.status });
        }

        const response = Response.json({
          ok: true,
          requestId,
          session: getSessionSummary(changed.session),
          auditCount: await getAuditCount(changed.session.activeContext),
          persistence: getPersistenceDiagnostics(),
        });

        changed.headers.forEach((value, key) => response.headers.append(key, value));
        return response;
      },
    },
  },
});
