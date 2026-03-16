import React, { useEffect, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Redo2, Strikethrough, Undo2 } from "lucide-react";
import { sanitizeRichTextHtml } from "../../lib/sanitize-rich-text";

type StudentNoteEditorProps = {
  initialTitle?: string;
  initialContentHtml?: string;
  onCancel: () => void;
  onSave: (payload: { title?: string; contentHtml: string; contentText: string }) => void;
  saveLabel?: string;
};

type ActiveFormats = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  bulletList: boolean;
  orderedList: boolean;
};

const EMPTY_FORMATS: ActiveFormats = {
  bold: false,
  italic: false,
  strike: false,
  bulletList: false,
  orderedList: false,
};

const ToolbarButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, isActive = false, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
      isActive
        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`}
  >
    {children}
  </button>
);

const toEditorHtml = (value?: string): string => {
  const sanitized = sanitizeRichTextHtml(value?.trim() ? value : "<p></p>");
  return sanitized.trim().length > 0 ? sanitized : "<p></p>";
};

const normalizeEditableHtml = (value: string): string => {
  const withParagraphs = value
    .replace(/&nbsp;/g, " ")
    .replace(/<(\/?)div\b/gi, "<$1p")
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "");
  return toEditorHtml(withParagraphs);
};

const normalizePlainText = (value: string): string => value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

export const StudentNoteEditor: React.FC<StudentNoteEditorProps> = ({
  initialTitle,
  initialContentHtml,
  onCancel,
  onSave,
  saveLabel = "Save note",
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [contentText, setContentText] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>(EMPTY_FORMATS);

  const syncEditorState = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setContentText(normalizePlainText(editor.innerText));
    try {
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        strike: document.queryCommandState("strikeThrough"),
        bulletList: document.queryCommandState("insertUnorderedList"),
        orderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch {
      setActiveFormats(EMPTY_FORMATS);
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = toEditorHtml(initialContentHtml);
    syncEditorState();
  }, [initialContentHtml]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const editor = editorRef.current;
      const selection = document.getSelection();
      if (!editor || !selection) return;
      const anchorNode = selection.anchorNode;
      if (anchorNode && editor.contains(anchorNode)) {
        syncEditorState();
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const runCommand = (command: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false);
    syncEditorState();
  };

  const isSaveDisabled = contentText.length === 0;

  const handleSave = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextText = normalizePlainText(editor.innerText);
    if (!nextText) {
      setSaveError("A note must include text before saving.");
      return;
    }
    setSaveError(null);
    onSave({
      title: title.trim() ? title.trim() : undefined,
      contentHtml: normalizeEditableHtml(editor.innerHTML),
      contentText: nextText,
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Optional title"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
      />
      <div className="flex flex-wrap gap-1">
        <ToolbarButton title="Bold" onClick={() => runCommand("bold")} isActive={activeFormats.bold}>
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => runCommand("italic")} isActive={activeFormats.italic}>
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton title="Strike" onClick={() => runCommand("strikeThrough")} isActive={activeFormats.strike}>
          <Strikethrough size={14} />
        </ToolbarButton>
        <ToolbarButton title="Bullet list" onClick={() => runCommand("insertUnorderedList")} isActive={activeFormats.bulletList}>
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => runCommand("insertOrderedList")} isActive={activeFormats.orderedList}>
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton title="Undo" onClick={() => runCommand("undo")}>
          <Undo2 size={14} />
        </ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => runCommand("redo")}>
          <Redo2 size={14} />
        </ToolbarButton>
      </div>
      <div className="relative">
        {!isFocused && contentText.length === 0 ? (
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">
            Write note details, observations, and action items...
          </span>
        ) : null}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            setSaveError(null);
            syncEditorState();
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            syncEditorState();
          }}
          className="min-h-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{contentText.length} characters</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveLabel}
          </button>
        </div>
      </div>
      {saveError ? <p className="text-xs font-semibold text-rose-600">{saveError}</p> : null}
    </div>
  );
};
