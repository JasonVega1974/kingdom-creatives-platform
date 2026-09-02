"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useState } from "react";

import { EMPTY_NOTE_BODY, NOTE_EXTENSIONS, type JSONContent } from "@/lib/portal/note-extensions";

/**
 * ============================================================
 * NOTE BODY EDITOR - the rich text field for My Notes
 * ============================================================
 *
 * Renders TipTap, but the form around it never sees an editor instance - it
 * sees one hidden input carrying the current document as JSON text, same
 * shape as every other field editor-kit.tsx supplies. Server Actions read
 * FormData either way; this is the one field whose value happens to be a
 * JSON string instead of plain text.
 *
 * NOT storing HTML. See lib/portal/note-extensions.ts for why the extension
 * list here has to stay identical to the one lib/portal/note-body.ts renders
 * with - that pairing is the entire sanitization design for this feature.
 */

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Sans", value: "Arial, Helvetica, sans-serif" },
  { label: "Monospace", value: "'Courier New', monospace" },
];

const TEXT_COLORS = [
  { label: "Default", value: "" },
  { label: "Red", value: "#B91C1C" },
  { label: "Blue", value: "#1D4ED8" },
  { label: "Green", value: "#15803D" },
  { label: "Purple", value: "#7C3AED" },
];

const HIGHLIGHT_COLORS = [
  { label: "None", value: "" },
  { label: "Yellow", value: "#FEF08A" },
  { label: "Green", value: "#BBF7D0" },
  { label: "Pink", value: "#FBCFE8" },
  { label: "Blue", value: "#BFDBFE" },
];

const TOOLBAR_SELECT =
  "rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] px-2 py-1 text-sm outline-none focus:border-[var(--kc-brand)]";

export function NoteBodyEditor({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: JSONContent | null;
}) {
  const [json, setJson] = useState<JSONContent>(defaultValue ?? EMPTY_NOTE_BODY);

  const editor = useEditor({
    extensions: NOTE_EXTENSIONS,
    content: defaultValue ?? EMPTY_NOTE_BODY,
    // Next.js SSRs the first render; TipTap otherwise warns about a
    // hydration mismatch because the editor's real DOM only exists client
    // side. Delaying means `editor` is null for one tick - handled below.
    immediatelyRender: false,
    onUpdate: ({ editor }) => setJson(editor.getJSON()),
    editorProps: {
      attributes: {
        class:
          "min-h-[140px] px-3 py-2 text-sm focus:outline-none [&_p]:my-1 first:[&_p]:mt-0 last:[&_p]:mb-0",
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
          <p className="px-3 py-2 text-sm text-[var(--kc-ink-soft)]">Loading editor...</p>
        )}
      </div>

      <input type="hidden" name={name} value={JSON.stringify(json)} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <ToggleButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToggleButton>
      <ToggleButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToggleButton>
      <ToggleButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline">U</span>
      </ToggleButton>

      <ToolbarSelect
        label="Font"
        options={FONT_FAMILIES}
        onChange={(value) => {
          if (value) editor.chain().focus().setFontFamily(value).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
      />
      <ToolbarSelect
        label="Color"
        options={TEXT_COLORS}
        onChange={(value) => {
          if (value) editor.chain().focus().setColor(value).run();
          else editor.chain().focus().unsetColor().run();
        }}
      />
      <ToolbarSelect
        label="Highlight"
        options={HIGHLIGHT_COLORS}
        onChange={(value) => {
          if (value) editor.chain().focus().toggleHighlight({ color: value }).run();
          else editor.chain().focus().unsetHighlight().run();
        }}
      />
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? "flex h-8 w-8 items-center justify-center rounded-[var(--kc-radius)] border border-[var(--kc-brand)] bg-[var(--kc-brand-wash)] text-sm font-semibold text-[var(--kc-brand)]"
          : "flex h-8 w-8 items-center justify-center rounded-[var(--kc-radius)] border border-[var(--kc-line)] text-sm font-semibold"
      }
    >
      {children}
    </button>
  );
}

function ToolbarSelect({
  label,
  options,
  onChange,
}: {
  label: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      defaultValue=""
      onChange={(event) => onChange(event.target.value)}
      className={TOOLBAR_SELECT}
    >
      {options.map((option) => (
        <option key={option.label} value={option.value}>
          {label}: {option.label}
        </option>
      ))}
    </select>
  );
}
