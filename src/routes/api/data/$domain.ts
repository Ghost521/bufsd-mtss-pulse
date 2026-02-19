import { createFileRoute } from "@tanstack/react-router";
import {
  CollectionStoreError,
  createDomainRow,
  deleteDomainRow,
  listDomainRows,
  replaceDomainRows,
  updateDomainRow,
  type DataDomain,
} from "../../../lib/server/collection-store";
import { appendActivityCookie, getSessionAuthFailureReason, getSessionFromRequest } from "../../../lib/server/auth-context";
import { requirePermission } from "../../../lib/server/rbac";
import type { AppResource } from "../../../lib/server/tenant-types";
import { newRequestId } from "../../../lib/server/audit-log";
import {
  BrandingStoreError,
  getOrCreateDistrictBranding,
  updateDistrictBranding,
} from "../../../lib/server/branding-store";
import { districtBrandingEditableSchema } from "../../../lib/schemas/branding";
import { SettingsStoreError, getOrCreateUserSettings, updateUserSettingsSection } from "../../../lib/server/settings-store";
import { sectionUpdateRequestSchema } from "../../../lib/schemas/settings";

const parseDomain = (value: string): DataDomain | null => {
  if (value === "branding") return "branding";
  if (value === "calendar") return "calendar";
  if (value === "messages") return "messages";
  if (value === "documents") return "documents";
  if (value === "interventions") return "interventions";
  if (value === "lesson-plans") return "lesson-plans";
  if (value === "imports") return "imports";
  if (value === "settings") return "settings";
  if (value === "staff") return "staff";
  if (value === "gradebook-assignments") return "gradebook-assignments";
  if (value === "gradebook-grades") return "gradebook-grades";
  if (value === "student-profiles") return "student-profiles";
  if (value === "referrals") return "referrals";
  return null;
};

const toResource = (domain: DataDomain): AppResource => {
  if (domain === "branding") return "settings";
  if (domain === "lesson-plans") return "lesson_plans";
  if (domain === "gradebook-assignments") return "gradebook_assignments";
  if (domain === "gradebook-grades") return "gradebook_grades";
  if (domain === "student-profiles") return "student_profiles";
  if (domain === "referrals") return "referrals";
  return domain;
};

const parseBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
};

const parseRow = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const fieldNamesFromRecord = (value: Record<string, unknown> | null): string[] =>
  value ? Object.keys(value).filter((key) => key !== "id") : [];

const fieldNamesFromRows = (rows: Record<string, unknown>[]): string[] =>
  Array.from(
    new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== "id")))
  );

export const Route = createFileRoute("/api/data/$domain")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        const permission = requirePermission(session, { resource: toResource(domain), action: "read" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        if (domain === "settings") {
          const settings = await getOrCreateUserSettings(session);
          return appendActivityCookie(Response.json({ ok: true, rows: [settings], total: 1, requestId }));
        }
        if (domain === "branding") {
          const branding = await getOrCreateDistrictBranding(session);
          return appendActivityCookie(Response.json({ ok: true, rows: [branding], total: 1, requestId }));
        }

        try {
          const rows = await listDomainRows<Record<string, unknown>>(session, domain);
          return appendActivityCookie(Response.json({ ok: true, rows, total: rows.length, requestId }));
        } catch (error) {
          if (error instanceof CollectionStoreError) {
            return Response.json({ ok: false, error: error.message, requestId }, { status: error.status });
          }
          return Response.json({ ok: false, error: "Unable to read records.", requestId }, { status: 500 });
        }
      },
      PUT: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        if (domain === "settings") {
          const permission = requirePermission(session, { resource: toResource(domain), action: "update" });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }
          return Response.json(
            { ok: false, error: "Bulk replace is not supported for settings.", requestId },
            { status: 405 }
          );
        }
        if (domain === "branding") {
          const permission = requirePermission(session, { resource: toResource(domain), action: "update" });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }
          return Response.json(
            { ok: false, error: "Bulk replace is not supported for branding.", requestId },
            { status: 405 }
          );
        }

        const body = await parseBody(request);
        const rows = Array.isArray(body?.rows) ? (body?.rows as Record<string, unknown>[]) : null;
        if (!rows) return Response.json({ ok: false, error: "Invalid payload. Expected rows array.", requestId }, { status: 400 });

        const permission = requirePermission(session, {
          resource: toResource(domain),
          action: "update",
          fields: fieldNamesFromRows(rows),
        });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        try {
          const next = await replaceDomainRows(session, domain, rows);
          return appendActivityCookie(Response.json({ ok: true, rows: next, total: next.length, requestId }));
        } catch (error) {
          if (error instanceof CollectionStoreError) {
            return Response.json({ ok: false, error: error.message, requestId }, { status: error.status });
          }
          return Response.json({ ok: false, error: "Unable to replace records.", requestId }, { status: 500 });
        }
      },
      POST: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        if (domain === "settings") {
          const permission = requirePermission(session, { resource: toResource(domain), action: "create" });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }
          return Response.json(
            { ok: false, error: "Create is not supported for settings.", requestId },
            { status: 405 }
          );
        }
        if (domain === "branding") {
          const permission = requirePermission(session, { resource: toResource(domain), action: "create" });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }
          return Response.json(
            { ok: false, error: "Create is not supported for branding.", requestId },
            { status: 405 }
          );
        }

        const body = await parseBody(request);
        const batchRows = Array.isArray(body?.rows) ? body.rows.map(parseRow) : null;
        if (batchRows) {
          if (batchRows.length === 0) {
            return Response.json({ ok: false, error: "Invalid payload. Expected non-empty rows array.", requestId }, { status: 400 });
          }

          const validRows = batchRows.filter((row): row is Record<string, unknown> => Boolean(row));
          const permission = requirePermission(session, {
            resource: toResource(domain),
            action: "create",
            fields: fieldNamesFromRows(validRows),
          });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }

          const createdRows: Record<string, unknown>[] = [];
          const errors: Array<{ index: number; reason: string }> = [];

          for (let index = 0; index < batchRows.length; index += 1) {
            const row = batchRows[index];
            if (!row) {
              errors.push({ index, reason: "Invalid row payload. Expected object." });
              continue;
            }

            try {
              const created = await createDomainRow(session, domain, row);
              createdRows.push(created as Record<string, unknown>);
            } catch (error) {
              if (error instanceof CollectionStoreError) {
                errors.push({ index, reason: error.message });
                continue;
              }
              errors.push({ index, reason: "Unable to create record." });
            }
          }

          return appendActivityCookie(Response.json({
            ok: errors.length === 0,
            total: batchRows.length,
            succeeded: createdRows.length,
            failed: errors.length,
            errors,
            rows: createdRows,
            requestId,
          }));
        }

        const row = parseRow(body?.row);
        if (!row) return Response.json({ ok: false, error: "Invalid payload. Expected row object.", requestId }, { status: 400 });

        const permission = requirePermission(session, {
          resource: toResource(domain),
          action: "create",
          fields: fieldNamesFromRecord(row),
        });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        try {
          const created = await createDomainRow(session, domain, row);
          return appendActivityCookie(Response.json({ ok: true, row: created, requestId }, { status: 201 }));
        } catch (error) {
          if (error instanceof CollectionStoreError) {
            return Response.json({ ok: false, error: error.message, requestId }, { status: error.status });
          }
          return Response.json({ ok: false, error: "Unable to create record.", requestId }, { status: 500 });
        }
      },
      PATCH: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        if (domain === "settings") {
          const permission = requirePermission(session, { resource: toResource(domain), action: "update" });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }
          const body = await parseBody(request);
          if (!body) return Response.json({ ok: false, error: "Invalid settings payload.", requestId }, { status: 400 });

          if (body.action === "password") {
            return Response.json(
              {
                ok: false,
                error: "Password changes are managed by WorkOS. Use your identity provider account settings.",
                requestId,
              },
              { status: 501 }
            );
          }

          const parsed = sectionUpdateRequestSchema.safeParse({
            section: body.section,
            data: body.data,
          });
          if (!parsed.success) {
            return Response.json(
              { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings payload.", requestId },
              { status: 400 }
            );
          }

          try {
            const updated = await updateUserSettingsSection(session, parsed.data.section, parsed.data.data);
            return appendActivityCookie(Response.json({ ok: true, row: updated, requestId }));
          } catch (error) {
            if (error instanceof SettingsStoreError) {
              return Response.json({ ok: false, error: error.message, requestId }, { status: error.status });
            }
            return Response.json({ ok: false, error: "Unable to update settings.", requestId }, { status: 500 });
          }
        }
        if (domain === "branding") {
          const permission = requirePermission(session, { resource: toResource(domain), action: "update" });
          if (!permission.ok) {
            return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
          }

          const body = await parseBody(request);
          const parsed = districtBrandingEditableSchema.safeParse(body?.data);
          if (!parsed.success) {
            return Response.json(
              { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid branding payload.", requestId },
              { status: 400 }
            );
          }

          try {
            const updated = await updateDistrictBranding(session, parsed.data);
            return appendActivityCookie(Response.json({ ok: true, row: updated, requestId }));
          } catch (error) {
            if (error instanceof BrandingStoreError) {
              return Response.json({ ok: false, error: error.message, requestId }, { status: error.status });
            }
            return Response.json({ ok: false, error: "Unable to update branding.", requestId }, { status: 500 });
          }
        }

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "Missing id query parameter.", requestId }, { status: 400 });

        const body = await parseBody(request);
        const patch = parseRow(body?.patch);
        if (!patch) return Response.json({ ok: false, error: "Invalid payload. Expected patch object.", requestId }, { status: 400 });

        const permission = requirePermission(session, {
          resource: toResource(domain),
          action: "update",
          fields: fieldNamesFromRecord(patch),
        });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        try {
          const updated = await updateDomainRow(session, domain, id, patch);
          if (!updated) return Response.json({ ok: false, error: "Record not found.", requestId }, { status: 404 });

          return appendActivityCookie(Response.json({ ok: true, row: updated, requestId }));
        } catch (error) {
          if (error instanceof CollectionStoreError) {
            return Response.json({ ok: false, error: error.message, requestId }, { status: error.status });
          }
          return Response.json({ ok: false, error: "Unable to update record.", requestId }, { status: 500 });
        }
      },
      DELETE: async ({ request, params }) => {
        const requestId = newRequestId();
        const domain = parseDomain(params.domain);
        if (!domain) return Response.json({ ok: false, error: "Unsupported domain.", requestId }, { status: 404 });

        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        const permission = requirePermission(session, { resource: toResource(domain), action: "delete" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        if (domain === "settings") {
          return Response.json(
            { ok: false, error: "Delete is not supported for settings.", requestId },
            { status: 405 }
          );
        }
        if (domain === "branding") {
          return Response.json(
            { ok: false, error: "Delete is not supported for branding.", requestId },
            { status: 405 }
          );
        }

        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return Response.json({ ok: false, error: "Missing id query parameter.", requestId }, { status: 400 });

        try {
          const deleted = await deleteDomainRow(session, domain, id);
          if (!deleted) return Response.json({ ok: false, error: "Record not found.", requestId }, { status: 404 });

          return appendActivityCookie(Response.json({ ok: true, row: deleted, requestId }));
        } catch (error) {
          if (error instanceof CollectionStoreError) {
            return Response.json({ ok: false, error: error.message, requestId }, { status: error.status });
          }
          return Response.json({ ok: false, error: "Unable to delete record.", requestId }, { status: 500 });
        }
      },
    },
  },
});
