import React, { useMemo, useState } from "react";
import { Clock3, History, Pencil, Plus, Trash2 } from "lucide-react";
import type { StudentNote } from "../../types";
import { createStudentNote, softDeleteStudentNote, updateStudentNote } from "../../lib/student-notes";
import { sanitizeRichTextHtml } from "../../lib/sanitize-rich-text";
import { StudentNoteEditor } from "./StudentNoteEditor";

type StudentNotesPanelProps = {
  notes: StudentNote[];
  canEdit: boolean;
  currentUserName: string;
  currentUserId?: string | null;
  onChange: (nextNotes: StudentNote[]) => void;
  emptyState?: string;
  className?: string;
};

type EditingState = { mode: "create" } | { mode: "edit"; noteId: string } | null;

const formatTimestamp = (value: string): string =>
  new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const NotePreview: React.FC<{ note: StudentNote }> = ({ note }) => {
  const safeHtml = useMemo(() => sanitizeRichTextHtml(note.contentHtml), [note.contentHtml]);
  return (
    <div
      className="prose prose-sm max-w-none text-slate-700 prose-p:my-1 prose-li:my-0.5"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
};

export const StudentNotesPanel: React.FC<StudentNotesPanelProps> = ({
  notes,
  canEdit,
  currentUserName,
  currentUserId,
  onChange,
  emptyState = "No staff notes recorded yet.",
  className = "",
}) => {
  const [editingState, setEditingState] = useState<EditingState>(null);
  const [historyNoteId, setHistoryNoteId] = useState<string | null>(null);

  const activeNotes = useMemo(
    () =>
      [...notes]
        .filter((note) => !note.isDeleted)
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [notes],
  );

  const historyNote = useMemo(
    () => activeNotes.find((note) => note.id === historyNoteId) ?? null,
    [activeNotes, historyNoteId],
  );

  const editNote = useMemo(
    () => (editingState?.mode === "edit" ? activeNotes.find((note) => note.id === editingState.noteId) ?? null : null),
    [activeNotes, editingState],
  );

  const actor = {
    userName: currentUserName,
    userId: currentUserId ?? undefined,
  };

  const applyCreate = (draft: { title?: string; contentHtml: string; contentText: string }) => {
    const created = createStudentNote(draft, actor);
    onChange([created, ...notes]);
    setEditingState(null);
  };

  const applyEdit = (draft: { title?: string; contentHtml: string; contentText: string }) => {
    if (!editNote) return;
    const updated = updateStudentNote(editNote, draft, actor);
    onChange(notes.map((note) => (note.id === editNote.id ? updated : note)));
    setEditingState(null);
  };

  const applyDelete = (noteId: string) => {
    const target = notes.find((note) => note.id === noteId);
    if (!target) return;
    const confirmed = window.confirm("Archive this note? It will be hidden from the default view but kept in history.");
    if (!confirmed) return;
    const deleted = softDeleteStudentNote(target, actor);
    onChange(notes.map((note) => (note.id === noteId ? deleted : note)));
    setHistoryNoteId((previous) => (previous === noteId ? null : previous));
    setEditingState((previous) => (previous?.mode === "edit" && previous.noteId === noteId ? null : previous));
  };

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Staff Notes</h3>
          <p className="text-xs text-slate-500">Visible to teachers, administrators, and intervention staff. Each save creates immutable history.</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditingState({ mode: "create" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <Plus size={14} />
            New note
          </button>
        ) : null}
      </div>

      {editingState?.mode === "create" ? (
        <StudentNoteEditor onCancel={() => setEditingState(null)} onSave={applyCreate} saveLabel="Create note" />
      ) : null}

      {activeNotes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{emptyState}</div>
      ) : (
        <div className="space-y-3">
          {activeNotes.map((note) => {
            const isEditingNote = editingState?.mode === "edit" && editingState.noteId === note.id;
            const showHistory = historyNoteId === note.id;

            return (
              <article key={note.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{note.title?.trim() ? note.title : "Untitled note"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        Created {formatTimestamp(note.createdAt)} by {note.createdByName}
                      </span>
                      <span className="text-slate-300">|</span>
                      <span>Edited {formatTimestamp(note.updatedAt)} by {note.updatedByName}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {note.revisionCount} revision{note.revisionCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHistoryNoteId((current) => (current === note.id ? null : note.id))}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <History size={12} />
                      History
                    </button>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingState({ mode: "edit", noteId: note.id })}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDelete(note.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                        >
                          <Trash2 size={12} />
                          Archive
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {isEditingNote && editNote ? (
                  <StudentNoteEditor
                    initialTitle={editNote.title}
                    initialContentHtml={editNote.contentHtml}
                    onCancel={() => setEditingState(null)}
                    onSave={applyEdit}
                    saveLabel="Save revision"
                  />
                ) : (
                  <NotePreview note={note} />
                )}

                {showHistory && historyNote ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Revision History</p>
                    <div className="space-y-2">
                      {[...historyNote.revisions]
                        .sort((left, right) => Date.parse(right.editedAt) - Date.parse(left.editedAt))
                        .map((revision) => (
                          <div key={revision.id} className="rounded-md border border-slate-200 bg-white p-2">
                            <p className="text-[11px] font-semibold text-slate-700">
                              {formatTimestamp(revision.editedAt)} - {revision.editedByName}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 line-clamp-3">{revision.contentText || "(No text content)"}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
