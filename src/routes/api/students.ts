import { createFileRoute } from "@tanstack/react-router";
import { Tier } from "../../types";
import {
  createMasterStudent,
  deleteMasterStudent,
  getStudentById,
  listStudents,
  updateMasterStudent,
  type CreateStudentInput,
  type StudentScope,
  type UpdateStudentInput,
} from "../../lib/server/student-store";
import { getSessionFromRequest, getSessionSummary } from "../../lib/server/auth-context";
import { requirePermission } from "../../lib/server/rbac";
import { newRequestId, writeAuditLog } from "../../lib/server/audit-log";

const toScope = (value: string | null): StudentScope => (value === "master" ? "master" : "class");

const isTier = (value: unknown): value is Tier => Object.values(Tier).includes(value as Tier);

const parseCreateStudentBody = (value: unknown): CreateStudentInput | null => {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.name !== "string" || body.name.trim().length === 0) return null;
  if (typeof body.grade !== "string" || body.grade.trim().length === 0) return null;
  if (!isTier(body.tier)) return null;
  if (typeof body.gpa !== "string" || body.gpa.trim().length === 0) return null;
  if (typeof body.attendance !== "number" || Number.isNaN(body.attendance)) return null;
  if (typeof body.readingLevel !== "string" || body.readingLevel.trim().length === 0) return null;

  return {
    name: body.name.trim(),
    grade: body.grade.trim(),
    tier: body.tier,
    gpa: body.gpa.trim(),
    attendance: Math.max(0, Math.min(100, Math.round(body.attendance))),
    readingLevel: body.readingLevel.trim(),
    schoolId: typeof body.schoolId === "string" ? body.schoolId.trim() : undefined,
  };
};

const parseUpdateStudentBody = (value: unknown): UpdateStudentInput | null => {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const patch: UpdateStudentInput = {};

  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.grade === "string") patch.grade = body.grade.trim();
  if (isTier(body.tier)) patch.tier = body.tier;
  if (typeof body.gpa === "string") patch.gpa = body.gpa.trim();
  if (typeof body.attendance === "number" && !Number.isNaN(body.attendance)) {
    patch.attendance = Math.max(0, Math.min(100, Math.round(body.attendance)));
  }
  if (typeof body.readingLevel === "string") patch.readingLevel = body.readingLevel.trim();

  return Object.keys(patch).length > 0 ? patch : null;
};

export const Route = createFileRoute("/api/students")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = newRequestId();
        const session = getSessionFromRequest(request);
        if (!session) {
          return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });
        }
        const permission = requirePermission(session, { resource: "students", action: "read" });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const url = new URL(request.url);
        const scope = toScope(url.searchParams.get("scope"));
        const rows = listStudents({
          scope,
          context: session.activeContext,
          requesterUserId: session.user.id,
          requesterRoles: session.effectiveRoles,
        });

        return Response.json({
          ok: true,
          rows,
          total: rows.length,
          scope,
          requestId,
          context: session.activeContext,
          session: getSessionSummary(session),
        });
      },
      POST: async ({ request }) => {
        const requestId = newRequestId();
        const session = getSessionFromRequest(request);
        if (!session) {
          return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as unknown;
        const parsed = parseCreateStudentBody(body);
        if (!parsed) {
          return Response.json({ ok: false, error: "Invalid student payload.", requestId }, { status: 400 });
        }

        const permission = requirePermission(session, {
          resource: "students",
          action: "create",
          fields: ["name", "grade", "tier", "gpa", "attendance", "readingLevel", "schoolId"],
        });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const created = createMasterStudent(parsed, session.activeContext, session.user.id);
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

        return Response.json({
          ok: true,
          row: created,
          requestId,
        }, { status: 201 });
      },
      PATCH: async ({ request }) => {
        const requestId = newRequestId();
        const session = getSessionFromRequest(request);
        if (!session) {
          return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });
        }

        const url = new URL(request.url);
        const studentId = url.searchParams.get("id");
        if (!studentId) {
          return Response.json({ ok: false, error: "Missing student id.", requestId }, { status: 400 });
        }

        const body = (await request.json().catch(() => null)) as unknown;
        const patch = parseUpdateStudentBody(body);
        if (!patch) {
          return Response.json({ ok: false, error: "Invalid update payload.", requestId }, { status: 400 });
        }

        const existing = getStudentById(studentId);
        if (!existing) {
          return Response.json({ ok: false, error: "Student not found.", requestId }, { status: 404 });
        }

        const changedFields = Object.keys(patch);
        const permission = requirePermission(session, {
          resource: "students",
          action: "update",
          fields: changedFields,
          targetStudentId: studentId,
        });
        if (!permission.ok) {
          return Response.json({ ok: false, error: permission.error, requestId }, { status: permission.status });
        }

        const updated = updateMasterStudent(studentId, patch, session.activeContext);
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

        return Response.json({ ok: true, row: updated, requestId });
      },
      DELETE: async ({ request }) => {
        const requestId = newRequestId();
        const session = getSessionFromRequest(request);
        if (!session) {
          return Response.json({ ok: false, error: "Unauthorized.", requestId }, { status: 401 });
        }

        const url = new URL(request.url);
        const studentId = url.searchParams.get("id");
        if (!studentId) {
          return Response.json({ ok: false, error: "Missing student id.", requestId }, { status: 400 });
        }

        const existing = getStudentById(studentId);
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

        const deleted = deleteMasterStudent(studentId, session.activeContext);
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

        return Response.json({ ok: true, row: deleted, requestId });
      },
    },
  },
});
