import { createFileRoute } from "@tanstack/react-router";
import {
  createMasterStudent,
  deleteMasterStudent,
  getStudentById,
  listStudents,
  updateMasterStudent,
  type StudentScope,
} from "../../lib/server/student-store";
import {
  appendActivityCookie,
  getSessionAuthFailureReason,
  getSessionFromRequest,
  getSessionSummary,
} from "../../lib/server/auth-context";
import { requirePermission } from "../../lib/server/rbac";
import { newRequestId, writeAuditLog } from "../../lib/server/audit-log";
import { createStudentInputSchema, updateStudentInputSchema } from "../../lib/schemas/students";

const toScope = (value: string | null): StudentScope => (value === "master" ? "master" : "class");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type BatchStudentError = { index: number; reason: string };

export const Route = createFileRoute("/api/students")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }
        const permission = requirePermission(session, { resource: "students", action: "read" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const url = new URL(request.url);
        const scope = toScope(url.searchParams.get("scope"));
        const rows = await listStudents({
          scope,
          context: session.activeContext,
          requesterUserId: session.user.id,
          requesterRoles: session.effectiveRoles,
        });

        return appendActivityCookie(Response.json({
          ok: true,
          rows,
          total: rows.length,
          scope,
          requestId,
          context: session.activeContext,
          session: getSessionSummary(session),
        }));
      },
      POST: async ({ request }) => {
        const requestId = newRequestId();
        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        const permission = requirePermission(session, {
          resource: "students",
          action: "create",
          fields: ["name", "grade", "tier", "gpa", "attendance", "readingLevel", "schoolId"],
        });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const body = (await request.json().catch(() => null)) as unknown;

        if (isRecord(body) && Array.isArray(body.rows)) {
          if (body.rows.length === 0) {
            return Response.json({ ok: false, error: "Rows array must include at least one item.", requestId }, { status: 400 });
          }

          const createdRows: Array<Awaited<ReturnType<typeof createMasterStudent>>> = [];
          const errors: BatchStudentError[] = [];

          for (let index = 0; index < body.rows.length; index += 1) {
            const candidate = body.rows[index];
            const parsedRow = createStudentInputSchema.safeParse(candidate);
            if (!parsedRow.success) {
              errors.push({ index, reason: parsedRow.error.issues[0]?.message ?? "Invalid student payload." });
              continue;
            }

            const created = await createMasterStudent(parsedRow.data, session.activeContext, session.user.id);
            if (!created) {
              errors.push({ index, reason: "Could not resolve target school for create." });
              continue;
            }

            createdRows.push(created);
            writeAuditLog({
              actorUserId: session.user.id,
              actorName: session.user.name,
              context: session.activeContext,
              resourceType: "students",
              resourceId: created.id,
              action: "create",
              changedFields: ["name", "grade", "tier", "gpa", "attendance", "readingLevel", "schoolId"],
              before: null,
              after: created,
              requestId,
            });
          }

          return appendActivityCookie(Response.json({
            ok: errors.length === 0,
            total: body.rows.length,
            succeeded: createdRows.length,
            failed: errors.length,
            errors,
            rows: createdRows,
            requestId,
          }));
        }

        const parsed = createStudentInputSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid student payload.", requestId },
            { status: 400 }
          );
        }

        const created = await createMasterStudent(parsed.data, session.activeContext, session.user.id);
        if (!created) {
          return Response.json({ ok: false, error: "Could not resolve target school for create.", requestId }, { status: 400 });
        }

        writeAuditLog({
          actorUserId: session.user.id,
          actorName: session.user.name,
          context: session.activeContext,
          resourceType: "students",
          resourceId: created.id,
          action: "create",
          changedFields: ["name", "grade", "tier", "gpa", "attendance", "readingLevel", "schoolId"],
          before: null,
          after: created,
          requestId,
        });

        return appendActivityCookie(Response.json({
          ok: true,
          row: created,
          requestId,
        }, { status: 201 }));
      },
      PATCH: async ({ request }) => {
        const requestId = newRequestId();
        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        const url = new URL(request.url);
        const studentId = url.searchParams.get("id");
        if (!studentId) {
          return Response.json({ ok: false, error: "Missing student id.", requestId }, { status: 400 });
        }

        const body = (await request.json().catch(() => null)) as unknown;
        const patch = updateStudentInputSchema.safeParse(body);
        if (!patch.success) {
          return Response.json(
            { ok: false, error: patch.error.issues[0]?.message ?? "Invalid update payload.", requestId },
            { status: 400 }
          );
        }

        const existing = await getStudentById(studentId, session.activeContext);
        if (!existing) {
          return Response.json({ ok: false, error: "Student not found.", requestId }, { status: 404 });
        }

        const changedFields = Object.keys(patch.data);
        const permission = requirePermission(session, {
          resource: "students",
          action: "update",
          fields: changedFields,
          targetStudentId: studentId,
        });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const updated = await updateMasterStudent(studentId, patch.data, session.activeContext);
        if (!updated) {
          return Response.json({ ok: false, error: "Student is outside active tenant context.", requestId }, { status: 403 });
        }

        writeAuditLog({
          actorUserId: session.user.id,
          actorName: session.user.name,
          context: session.activeContext,
          resourceType: "students",
          resourceId: updated.id,
          action: "update",
          changedFields,
          before: existing,
          after: updated,
          requestId,
        });

        return appendActivityCookie(Response.json({ ok: true, row: updated, requestId }));
      },
      DELETE: async ({ request }) => {
        const requestId = newRequestId();
        const session = await getSessionFromRequest(request);
        if (!session) {
          const reason = getSessionAuthFailureReason(request);
          return Response.json({ ok: false, error: "Unauthorized.", reason: reason ?? undefined, requestId }, { status: 401 });
        }

        const url = new URL(request.url);
        const studentId = url.searchParams.get("id");
        if (!studentId) {
          return Response.json({ ok: false, error: "Missing student id.", requestId }, { status: 400 });
        }

        const existing = await getStudentById(studentId, session.activeContext);
        if (!existing) {
          return Response.json({ ok: false, error: "Student not found.", requestId }, { status: 404 });
        }

        const permission = requirePermission(session, {
          resource: "students",
          action: "delete",
          targetStudentId: studentId,
        });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const deleted = await deleteMasterStudent(studentId, session.activeContext);
        if (!deleted) {
          return Response.json({ ok: false, error: "Student is outside active tenant context.", requestId }, { status: 403 });
        }

        writeAuditLog({
          actorUserId: session.user.id,
          actorName: session.user.name,
          context: session.activeContext,
          resourceType: "students",
          resourceId: deleted.id,
          action: "delete",
          changedFields: [],
          before: existing,
          after: null,
          requestId,
        });

        return appendActivityCookie(Response.json({ ok: true, row: deleted, requestId }));
      },
    },
  },
});
