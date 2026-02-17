import { createFileRoute } from "@tanstack/react-router";
import { canSwitchUsersInSession, getSessionFromRequest, getSessionSummary, resolveSessionChange } from "../../lib/server/auth-context";
import { getAuditCount, newRequestId } from "../../lib/server/audit-log";
import { getPersistenceDiagnostics } from "../../lib/server/persistence";
import { getUsers } from "../../lib/server/tenant-store";
import { getWorkOSConfigSummary, isWorkOSEnabled } from "../../lib/server/workos";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const session = await getSessionFromRequest(request);
        const summary = getSessionSummary(session);
        const auditCount = session ? await getAuditCount(session.activeContext) : 0;
        const canSwitchUsers = canSwitchUsersInSession();
        const workosEnabled = isWorkOSEnabled();

        return Response.json({
          ok: true,
          timestamp: new Date().toISOString(),
          environment: "start-server-route" as const,
          requestId,
          session: summary,
          authConfigured: true,
          auth: {
            workosEnabled,
            signedIn: Boolean(summary),
            canSwitchUsers,
            workos: getWorkOSConfigSummary(),
          },
          availableUsers: canSwitchUsers
            ? getUsers().map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                primaryRole: user.primaryRole,
              }))
            : [],
          auditCount,
          persistence: getPersistenceDiagnostics(),
        });
      },
      POST: async ({ request }) => {
        const requestId = newRequestId();
        const body = (await request.json().catch(() => null)) as unknown;
        const changed = await resolveSessionChange(request, body);
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
