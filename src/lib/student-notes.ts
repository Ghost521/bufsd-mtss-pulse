import type { StudentNote, StudentNoteRevision } from "../types";
import { sanitizeRichTextHtml } from "./sanitize-rich-text";

type Actor = {
  userName: string;
  userId?: string | null;
};

type NoteDraft = {
  title?: string;
  contentHtml: string;
  contentText: string;
};

const nowIso = (): string => new Date().toISOString();

const nextId = (prefix: string): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const normalizeNoteText = (value: string): string => value.replace(/\s+/g, " ").trim();

const buildRevision = (draft: NoteDraft, actor: Actor, editedAt: string): StudentNoteRevision => ({
  id: nextId("note-revision"),
  contentHtml: sanitizeRichTextHtml(draft.contentHtml),
  contentText: normalizeNoteText(draft.contentText),
  editedAt,
  editedByUserId: actor.userId ?? undefined,
  editedByName: actor.userName,
});

export const createStudentNote = (draft: NoteDraft, actor: Actor): StudentNote => {
  const timestamp = nowIso();
  const safeHtml = sanitizeRichTextHtml(draft.contentHtml);
  const firstRevision = buildRevision(draft, actor, timestamp);
  return {
    id: nextId("student-note"),
    title: draft.title?.trim() ? draft.title.trim() : undefined,
    contentHtml: safeHtml,
    contentText: normalizeNoteText(draft.contentText),
    createdAt: timestamp,
    createdByUserId: actor.userId ?? undefined,
    createdByName: actor.userName,
    updatedAt: timestamp,
    updatedByUserId: actor.userId ?? undefined,
    updatedByName: actor.userName,
    visibility: "staff",
    revisionCount: 1,
    revisions: [firstRevision],
  };
};

export const updateStudentNote = (note: StudentNote, draft: NoteDraft, actor: Actor): StudentNote => {
  const nextTitle = draft.title?.trim() ? draft.title.trim() : undefined;
  const nextHtml = sanitizeRichTextHtml(draft.contentHtml);
  const nextText = normalizeNoteText(draft.contentText);

  const titleUnchanged = (note.title ?? "") === (nextTitle ?? "");
  const htmlUnchanged = note.contentHtml === nextHtml;
  const textUnchanged = note.contentText === nextText;
  if (titleUnchanged && htmlUnchanged && textUnchanged && !note.isDeleted) {
    return note;
  }

  const timestamp = nowIso();
  const nextRevision = buildRevision(
    {
      title: nextTitle,
      contentHtml: nextHtml,
      contentText: nextText,
    },
    actor,
    timestamp,
  );

  const revisions = [...note.revisions, nextRevision];
  return {
    ...note,
    title: nextTitle,
    contentHtml: nextHtml,
    contentText: nextText,
    updatedAt: timestamp,
    updatedByUserId: actor.userId ?? undefined,
    updatedByName: actor.userName,
    isDeleted: false,
    deletedAt: undefined,
    deletedByUserId: undefined,
    deletedByName: undefined,
    revisionCount: revisions.length,
    revisions,
  };
};

export const softDeleteStudentNote = (note: StudentNote, actor: Actor): StudentNote => {
  if (note.isDeleted) return note;
  const timestamp = nowIso();
  return {
    ...note,
    isDeleted: true,
    deletedAt: timestamp,
    deletedByUserId: actor.userId ?? undefined,
    deletedByName: actor.userName,
    updatedAt: timestamp,
    updatedByUserId: actor.userId ?? undefined,
    updatedByName: actor.userName,
  };
};
