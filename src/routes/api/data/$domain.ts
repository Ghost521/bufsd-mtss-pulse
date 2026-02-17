import { createFileRoute } from "@tanstack/react-router";
import { createDomainRow, deleteDomainRow, listDomainRows, replaceDomainRows, updateDomainRow, type DataDomain } from "../../../lib/server/collection-store";
import { getSessionFromRequest } from "../../../lib/server/auth-context";
import { requirePermission } from "../../../lib/server/rbac";
import { newRequestId } from "../../../lib/server/audit-log";

type DomainResource = "calendar" | "messages" | "documents" | "interventions" | "lesson_plans" | "imports";

const parseDomain = (value: string): DataDomain | null => {
  if (value === "calendar") return "calendar";
  if (value === "messages") return "messages";
  if (value === "documents") return "documents";
  if (value === "interventions") return "interventions";
  if (value === "lesson-plans") return "lesson-plans";
  if (value === "imports") return "imports";
  return null;
};

const toResource = (domain: DataDomain): DomainResource => (domain === "lesson-plans" ? "lesson_plans" : domain);

const parseBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
};

const parseRow = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const Route = createFileRoute("/api/data/$domain")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });

        const permission = requirePermission(session, { resource: toResource(domain), action: "read" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const rows = await listDomainRows<Record<string, unknown>>(session, domain);
        return Response.json({ ok: true, rows, total: rows.length, requestId });
      },
      PUT: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });

        const permission = requirePermission(session, { resource: toResource(domain), action: "update" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const body = await parseBody(request);
        const rows = Array.isArray(body?.rows) ? (body?.rows as Record<string, unknown>[]) : null;
        if (!rows) return Response.json({ ok: false, error: "Invalid payload. Expected rows array.", requestId }, { status: 400 });

        const next = await replaceDomainRows(session, domain, rows);
        return Response.json({ ok: true, rows: next, total: next.length, requestId });
      },
      POST: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });

        const permission = requirePermission(session, { resource: toResource(domain), action: "create" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const body = await parseBody(request);
        const row = parseRow(body?.row);
        if (!row) return Response.json({ ok: false, error: "Invalid payload. Expected row object.", requestId }, { status: 400 });

        const created = await createDomainRow(session, domain, row);
        return Response.json({ ok: true, row: created, requestId }, { status: 201 });
      },
      PATCH: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });

        const permission = requirePermission(session, { resource: toResource(domain), action: "update" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "Missing id query parameter.", requestId }, { status: 400 });

        const body = await parseBody(request);
        const patch = parseRow(body?.patch);
        if (!patch) return Response.json({ ok: false, error: "Invalid payload. Expected patch object.", requestId }, { status: 400 });

        const updated = await updateDomainRow(session, domain, id, patch);
        if (!updated) return Response.json({ ok: false, error: "Record not found.", requestId }, { status: 404 });

        return Response.json({ ok: true, row: updated, requestId });
      },
      DELETE: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });

        const permission = requirePermission(session, { resource: toResource(domain), action: "delete" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "Missing id query parameter.", requestId }, { status: 400 });

        const deleted = await deleteDomainRow(session, domain, id);
        if (!deleted) return Response.json({ ok: false, error: "Record not found.", requestId }, { status: 404 });

        return Response.json({ ok: true, row: deleted, requestId });
      },
    },
  },
});
