import React, { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, Redo2, Strikethrough, Undo2 } from "lucide-react";

type StudentNoteEditorProps = {
  initialTitle?: string;
  initialContentHtml?: string;
  onCancel: () => void;
  onSave: (payload: { title?: string; contentHtml: string; contentText: string }) => void;
  saveLabel?: string;
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

export const StudentNoteEditor: React.FC<StudentNoteEditorProps> = ({
  initialTitle,
  initialContentHtml,
  onCancel,
  onSave,
  saveLabel = "Save note",
}) => {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [contentText, setContentText] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Write note details, observations, and action items...",
      }),
    ],
    content: initialContentHtml && initialContentHtml.trim().length > 0 ? initialContentHtml : "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none",
      },
    },
    autofocus: "end",
    onUpdate: ({ editor: nextEditor }) => {
      setContentText(nextEditor.getText().replace(/\s+/g, " ").trim());
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(
      initialContentHtml && initialContentHtml.trim().length > 0 ? initialContentHtml : "<p></p>",
      { emitUpdate: false },
    );
    setContentText(editor.getText().replace(/\s+/g, " ").trim());
  }, [editor, initialContentHtml]);

  const isSaveDisabled = contentText.length === 0;

  const handleSave = () => {
    if (!editor) return;
    const nextText = editor.getText().replace(/\s+/g, " ").trim();
    if (!nextText) {
      setSaveError("A note must include text before saving.");
      return;
    }
    setSaveError(null);
    onSave({
      title: title.trim() ? title.trim() : undefined,
      contentHtml: editor.getHTML(),
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
        <ToolbarButton title="Bold" onClick={() => editor?.chain().focus().toggleBold().run()} isActive={editor?.isActive("bold")}>
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()} isActive={editor?.isActive("italic")}>
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton title="Strike" onClick={() => editor?.chain().focus().toggleStrike().run()} isActive={editor?.isActive("strike")}>
          <Strikethrough size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          isActive={editor?.isActive("bulletList")}
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          isActive={editor?.isActive("orderedList")}
        >
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton title="Undo" onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 size={14} />
        </ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 size={14} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
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
