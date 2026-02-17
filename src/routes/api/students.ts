import { createFileRoute } from "@tanstack/react-router";
import { Tier } from "../../types";
import {
  createMasterStudent,
  deleteMasterStudent,
  listStudents,
  updateMasterStudent,
  type CreateStudentInput,
  type StudentScope,
  type UpdateStudentInput,
} from "../../lib/server/student-store";

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
        const url = new URL(request.url);
        const scope = toScope(url.searchParams.get("scope"));
        const rows = listStudents(scope);

        return Response.json({
          rows,
          total: rows.length,
          scope,
        });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as unknown;
        const parsed = parseCreateStudentBody(body);
        if (!parsed) {
          return Response.json({ error: "Invalid student payload." }, { status: 400 });
        }

        const created = createMasterStudent(parsed);
        return Response.json({
          row: created,
        }, { status: 201 });
      },
      PATCH: async ({ request }) => {
        const url = new URL(request.url);
        const studentId = url.searchParams.get("id");
        if (!studentId) {
          return Response.json({ error: "Missing student id." }, { status: 400 });
        }

        const body = (await request.json().catch(() => null)) as unknown;
        const patch = parseUpdateStudentBody(body);
        if (!patch) {
          return Response.json({ error: "Invalid update payload." }, { status: 400 });
        }

        const updated = updateMasterStudent(studentId, patch);
        if (!updated) {
          return Response.json({ error: "Student not found." }, { status: 404 });
        }

        return Response.json({ row: updated });
      },
      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const studentId = url.searchParams.get("id");
        if (!studentId) {
          return Response.json({ error: "Missing student id." }, { status: 400 });
        }

        const deleted = deleteMasterStudent(studentId);
        if (!deleted) {
          return Response.json({ error: "Student not found." }, { status: 404 });
        }

        return Response.json({ row: deleted });
      },
    },
  },
});
