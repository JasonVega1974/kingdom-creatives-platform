"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";

import { SERMON_EXTENSIONS, type JSONContent } from "@/lib/portal/sermon-extensions";

/**
 * The manuscript editor: TipTap over the SERMON_EXTENSIONS schema, with the
 * Notes toolbar extended by exactly what the schema adds - headings, lists,
 * blockquote. Same design as note-body-editor.tsx, one difference: the
 * parent needs the live document (to save, print, and feed retries), so
 * this exposes onChange with the JSON rather than a hidden form input.
 */
export function SermonBodyEditor({
  initial,
  onChange,
}: {
  initial: JSONContent;
  onChange: (doc: JSONContent) => void;
}) {
  const editor = useEditor({
    extensions: SERMON_EXTENSIONS,
    content: initial,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: {
      attributes: {
        class:
          "kc-manuscript min-h-[380px] px-4 py-3 text-[15px] leading-relaxed focus:outline-none",
      },
    },
  });

  return (
    <div>
      {editor ? (
        <Toolbar editor={editor} />
      ) : (
        <div className="mb-2 h-9 rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-paper-dim)]" />
      )}

      <div className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)]">
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <p className="px-4 py-3 text-sm text-[var(--kc-ink-soft)]">Loading editor...</p>
        )}
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const buttons: { label: string; text: React.ReactNode; active: boolean; run: () => void }[] = [
    {
      label: "Bold",
      text: "B",
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "Italic",
      text: <span className="italic">I</span>,
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "Underline",
      text: <span className="underline">U</span>,
      active: editor.isActive("underline"),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: "Section heading",
      text: "H2",
      active: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Subheading",
      text: "H3",
      active: editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "Bullet list",
      text: "•",
      active: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      text: "1.",
      active: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Scripture quote",
      text: "“”",
      active: editor.isActive("blockquote"),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          aria-label={button.label}
          aria-pressed={button.active}
          onClick={button.run}
          className={
            button.active
              ? "flex h-8 min-w-8 items-center justify-center rounded-[var(--kc-radius)] border border-[var(--kc-brand)] bg-[var(--kc-brand-wash)] px-1.5 text-sm font-semibold text-[var(--kc-brand)]"
              : "flex h-8 min-w-8 items-center justify-center rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-1.5 text-sm font-semibold"
          }
        >
          {button.text}
        </button>
      ))}
    </div>
  );
}
