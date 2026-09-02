import "server-only";

import { generateHTML } from "@tiptap/html";

import { NOTE_EXTENSIONS, type JSONContent } from "@/lib/portal/note-extensions";

/**
 * TipTap JSON -> HTML, for the read view. Server-only so the parsing code
 * (@tiptap/html, via zeed-dom - a pure-JS DOM, not a browser) never ships to
 * the client; only the edit form needs the live editor.
 *
 * generateHTML builds a Prosemirror schema from NOTE_EXTENSIONS and calls
 * Node.fromJSON(schema, doc) - which THROWS on any node or mark type outside
 * that schema. A note's body_json can only have been produced by the one
 * editor that shares this same extension list, so that should never happen -
 * but if a row is ever malformed (a manual SQL edit, a future migration
 * mistake), fail to an empty read rather than let generateHTML's error take
 * down the whole notes list.
 */
export function noteBodyToHtml(body: JSONContent | null | undefined): string {
  if (!body) return "";

  try {
    return generateHTML(body, NOTE_EXTENSIONS);
  } catch (error) {
    console.error(`[portal] note body failed to render: ${(error as Error).message}`);
    return "<p><em>This note could not be displayed.</em></p>";
  }
}
