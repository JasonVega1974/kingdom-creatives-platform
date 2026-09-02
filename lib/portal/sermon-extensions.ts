import Blockquote from "@tiptap/extension-blockquote";
import BulletList from "@tiptap/extension-bullet-list";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import ListItem from "@tiptap/extension-list-item";
import OrderedList from "@tiptap/extension-ordered-list";

import { NOTE_EXTENSIONS, type JSONContent } from "@/lib/portal/note-extensions";

/**
 * ============================================================
 * SERMON MANUSCRIPT - the closed schema for sermons.body_json
 * ============================================================
 *
 * The Notes allowlist, extended deliberately for a 2,500-word manuscript:
 * headings (levels 2-3 only, matching the generation prompts' ## and ###),
 * bullet and ordered lists, blockquote for scripture readings, and hard
 * breaks. Same design as lib/portal/note-extensions.ts and the same rule:
 * the editor (components/portal/sermon-body-editor.tsx) and every renderer
 * import THIS array, so nothing outside it is ever representable.
 *
 * DELIBERATELY STILL EXCLUDED: links, images, tables. A manuscript is
 * preached text - none of those carry pulpit value, and every exclusion
 * keeps the no-sanitizer-needed story airtight.
 */

export const SERMON_EXTENSIONS = [
  ...NOTE_EXTENSIONS,
  Heading.configure({ levels: [2, 3] }),
  BulletList,
  OrderedList,
  ListItem,
  Blockquote,
  HardBreak,
];

export type { JSONContent };
