import { createFileRoute } from "@tanstack/react-router";
import { appendActivityCookie, getSessionAuthFailureReason, getSessionFromRequest } from "../../lib/server/auth-context";
import { listAuditLogs, newRequestId } from "../../lib/server/audit-log";
import { logApiResponse } from "../../lib/server/request-logging";
import { requirePermission } from "../../lib/server/rbac";

const toAction = (value: string | null): "create" | "update" | "delete" | "read" | undefined => {
  if (value === "create" || value === "update" || value === "delete" || value === "read") return value;
  return undefined;
};

const toIsoOrUndefined = (value: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return Number.isNaN(Date.parse(trimmed)) ? undefined : trimmed;
};

const toLimit = (value: string | null): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(parsed, 200);
};

export const Route = createFileRoute("/api/audit" as never)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const startedAt = Date.now();
        const session = await getSessionFromRequest(request);

        const response = await (async () => {
          if (!session) {
            const reason = getSessionAuthFailureReason(request);
            return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
          }

          const permission = requirePermission(session, { resource: "audit", action: "read" });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }

          const url = new URL(request.url);
          const rows = await listAuditLogs(session.activeContext, {
            actorUserId: url.searchParams.get("actorUserId")?.trim() || undefined,
            resourceType: url.searchParams.get("resourceType")?.trim() || undefined,
            resourceId: url.searchParams.get("resourceId")?.trim() || undefined,
            action: toAction(url.searchParams.get("action")),
            from: toIsoOrUndefined(url.searchParams.get("from")),
            to: toIsoOrUndefined(url.searchParams.get("to")),
            limit: toLimit(url.searchParams.get("limit")),
          });

          return appendActivityCookie(Response.json({
            ok: true,
            rows,
            total: rows.length,
            requestId,
          }));
        })();

        return logApiResponse({
          request,
          requestId,
          route: "/api/audit",
          startedAt,
          response,
          session,
        });
      },
    },
  },
});
