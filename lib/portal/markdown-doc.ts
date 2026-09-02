import "server-only";

import { generateHTML, generateJSON } from "@tiptap/html";

import { SERMON_EXTENSIONS, type JSONContent } from "@/lib/portal/sermon-extensions";

/**
 * ============================================================
 * MARKDOWN -> TIPTAP JSON, for generated sermon manuscripts
 * ============================================================
 *
 * The generation prompts demand Markdown (## sections, ### subpoints,
 * numbered main points, bullet application steps) because that is what the
 * recovered WordPress prompts demanded, and it converts deterministically.
 * This is a port of the old builder's 60-line JS converter, not a Markdown
 * library: it handles exactly the constructs the prompts ask for, and
 * everything it does not recognise becomes an escaped paragraph.
 *
 * The escape-then-parse order is the safety story: every line of model
 * output is HTML-ESCAPED before any tags are assembled around it, and the
 * assembled HTML then passes through generateJSON with the closed
 * SERMON_EXTENSIONS schema, which drops anything unrepresentable. Model
 * output can therefore never smuggle markup into body_json - same
 * guarantee the Notes editor has, arrived at from the opposite direction.
 */

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Inline **bold** and *italic*, applied AFTER escaping. */
function inline(escaped: string): string {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  let html = "";
  let list: "ul" | "ol" | null = null;

  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      closeList();
      continue;
    }

    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      closeList();
      html += `<h2>${inline(escapeHtml(h2[1]))}</h2>`;
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) {
      closeList();
      html += `<h3>${inline(escapeHtml(h3[1]))}</h3>`;
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      html += `<blockquote><p>${inline(escapeHtml(quote[1]))}</p></blockquote>`;
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        html += "<ul>";
        list = "ul";
      }
      html += `<li><p>${inline(escapeHtml(bullet[1]))}</p></li>`;
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.*)$/);
    if (numbered) {
      if (list !== "ol") {
        closeList();
        html += "<ol>";
        list = "ol";
      }
      html += `<li><p>${inline(escapeHtml(numbered[1]))}</p></li>`;
      continue;
    }

    closeList();
    html += `<p>${inline(escapeHtml(line))}</p>`;
  }

  closeList();
  return html;
}

/** Markdown (from generation) -> the body_json document. */
export function markdownToDoc(markdown: string): JSONContent {
  return generateJSON(markdownToHtml(markdown), SERMON_EXTENSIONS) as JSONContent;
}

/** body_json -> plain text, for feeding a saved manuscript back into the
    summary/slides/social prompts on a per-section retry. */
export function sermonBodyToText(body: JSONContent | null | undefined): string {
  return sermonBodyToHtml(body)
    .replace(/<\/(p|h2|h3|li|blockquote)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .trim();
}

/** body_json -> HTML for read views and print. Same failure posture as
    lib/portal/note-body.ts: a malformed row degrades, never crashes. */
export function sermonBodyToHtml(body: JSONContent | null | undefined): string {
  if (!body) return "";
  try {
    return generateHTML(body, SERMON_EXTENSIONS);
  } catch (error) {
    console.error(`[portal] sermon body failed to render: ${(error as Error).message}`);
    return "<p><em>This manuscript could not be displayed.</em></p>";
  }
}
