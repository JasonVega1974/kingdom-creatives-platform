import Bold from "@tiptap/extension-bold";
import Color from "@tiptap/extension-color";
import Document from "@tiptap/extension-document";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import History from "@tiptap/extension-history";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import type { JSONContent } from "@tiptap/core";

/**
 * ============================================================
 * NOTE BODY - the one schema every reader and writer must share
 * ============================================================
 *
 * This is the entire sanitization story for My Notes: a note's body is stored
 * as TipTap JSON, never HTML, and this array is the CLOSED set of node/mark
 * types that JSON is allowed to contain - bold, italic, underline, a font
 * family, a text color, a highlight color. Nothing else.
 *
 * That closure is what makes the content safe to render back without a
 * sanitizer. lib/portal/note-body.ts's generateHTML() call is handed this
 * same array, so a JSON document containing anything outside this schema
 * fails to parse rather than rendering unknown markup - see that file's
 * header for what that failure path does.
 *
 * DO NOT add a node/mark extension here without checking generateHTML's
 * caller can still render it in a Server Component - the point of this file
 * is that the editor (components/portal/note-body-editor.tsx, client) and the
 * renderer (lib/portal/note-body.ts, server) import the SAME array. Diverging
 * them defeats the whole design.
 */

export const NOTE_EXTENSIONS = [
  Document,
  Paragraph,
  Text,
  Bold,
  Italic,
  Underline,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  FontFamily,
  History,
];

/** What a brand-new note's body starts as - one empty paragraph. */
export const EMPTY_NOTE_BODY: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export type { JSONContent };
