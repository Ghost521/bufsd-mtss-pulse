import { createFileRoute } from "@tanstack/react-router";
import {
  appendActivityCookie,
  canSwitchUsersInSession,
  getSessionAuthFailureReason,
  getSessionFromRequest,
  getSessionSummary,
  isDevAuthBypassEnabled,
  resolveSessionChange,
} from "../../lib/server/auth-context";
import { getAuditCount, newRequestId } from "../../lib/server/audit-log";
import { getPersistenceDiagnostics } from "../../lib/server/persistence";
import { logApiResponse } from "../../lib/server/request-logging";
import { getUsers, isWorkOSAutoProvisionEnabled } from "../../lib/server/tenant-store";
import { getWorkOSConfigSummary, isWorkOSEnabled } from "../../lib/server/workos";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const startedAt = Date.now();
        const session = await getSessionFromRequest(request);

        const response = await (async () => {
          const summary = getSessionSummary(session);
          const authReason = getSessionAuthFailureReason(request);
          const auditCount = session ? await getAuditCount(session.activeContext) : 0;
          const canSwitchUsers = canSwitchUsersInSession();
          const workosEnabled = isWorkOSEnabled();

          const next = Response.json({
            ok: true,
            timestamp: new Date().toISOString(),
            environment: "start-server-route" as const,
            requestId,
            session: summary,
            authConfigured: true,
            auth: {
              workosEnabled,
              signedIn: Boolean(summary),
              reason: !summary && authReason ? authReason : undefined,
              canSwitchUsers,
              devAuthBypassEnabled: isDevAuthBypassEnabled(),
              autoProvisionEnabled: isWorkOSAutoProvisionEnabled(),
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
          return summary ? appendActivityCookie(next) : next;
        })();

        return logApiResponse({
          request,
          requestId,
          route: "/api/health",
          startedAt,
          response,
          session,
        });
      },
      POST: async ({ request }) => {
        const requestId = newRequestId();
        const startedAt = Date.now();
        const session = await getSessionFromRequest(request);

        const response = await (async () => {
          const body = (await request.json().catch(() => null)) as unknown;
          const changed = await resolveSessionChange(request, body);
          if ("error" in changed) {
            const authReason = changed.status === 401 ? getSessionAuthFailureReason(request) : null;
            return Response.json(
              { ok: false, error: changed.error, reason: authReason ?? undefined, requestId },
              { status: changed.status }
            );
          }

          const next = Response.json({
            ok: true,
            requestId,
            session: getSessionSummary(changed.session),
            auditCount: await getAuditCount(changed.session.activeContext),
            persistence: getPersistenceDiagnostics(),
          });

          changed.headers.forEach(([key, value]) => next.headers.append(key, value));
          return next;
        })();

        return logApiResponse({
          request,
          requestId,
          route: "/api/health",
          startedAt,
          response,
          session,
        });
      },
    },
  },
});
