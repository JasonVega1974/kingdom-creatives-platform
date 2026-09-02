import "server-only";

/**
 * ============================================================
 * SERMON BUILDER PROMPTS - ported from the WordPress original
 * ============================================================
 *
 * The substance here is recovered tuning work: the ten-part structure, the
 * seven style descriptions, the word targets, the formatting rules and the
 * closing-prayer instruction all come from pastor-portal-plugin's
 * class-sermon-ajax.php (read from the backup 2026-09-02), ported for the
 * Anthropic Messages API. Four deliberate departures, per the approved
 * scope:
 *
 *   1. A REAL SYSTEM PROMPT. The original sent bare input with no system
 *      message; the pastoral-voice instruction lives there now, where it
 *      belongs, instead of trailing the user prompt.
 *   2. MAX TOKENS 5000 FOR THE MAIN CALL, not the original 3000. The old
 *      cap contradicted its own 2000-3000 WORD target (3000 tokens is
 *      roughly 2,250 words) and could truncate the closing prayer. A
 *      latent bug, not tuning worth preserving.
 *   3. "(ESV)" stays as a translation hint, but the model is not the ESV:
 *      quoted scripture is not guaranteed word-perfect. The licensed ESV
 *      API exists if exact quotation injection is ever wanted.
 *   4. Two NEW prompts (slides, social) for the add-ons WordPress never
 *      built, approved as written 2026-09-03. Both demand bare JSON;
 *      parseJsonBlock() strips the markdown fences Claude sometimes adds
 *      despite instructions, so a fenced answer costs nothing and a
 *      malformed one costs one per-section retry, never the batch.
 *
 * Multi-tenant rule applies here too: nothing church-specific, ever.
 */

export const SERMON_SYSTEM_PROMPT =
  "You are a sermon-writing assistant for a church pastor. Write biblically " +
  "sound, encouraging material in a natural, conversational preaching style - " +
  "warm, direct, and easy to deliver aloud. Stay faithful to the passage's " +
  "actual meaning. Never include meta-commentary about being an AI, and never " +
  "address the pastor - write the material itself, ready to use.";

/** The seven styles, descriptions verbatim from the original. */
export const SERMON_STYLES: { value: string; label: string; description: string }[] = [
  { value: "expository", label: "Traditional / Expository", description: "Traditional expository preaching that explains the text verse by verse" },
  { value: "topical", label: "Topical Teaching", description: "Topical teaching focused on a specific subject or theme" },
  { value: "narrative", label: "Narrative / Story-Based", description: "Story-based preaching using narratives and illustrations" },
  { value: "youth", label: "Youth / Student Focused", description: "Youth-focused with contemporary language and examples" },
  { value: "evangelistic", label: "Evangelistic / Outreach", description: "Outreach-focused with emphasis on salvation and invitation" },
  { value: "devotional", label: "Short Devotional", description: "Short, reflective devotional style" },
  { value: "verse_by_verse", label: "Verse-by-Verse", description: "Detailed verse-by-verse exposition" },
];

/* The original's audience field was removed from its form and hardcoded;
   ported as-is. */
const AUDIENCE = "mixed congregation of all ages";

export type SermonPromptInput = {
  title: string;
  passage: string; // "John 3:1-10 (ESV)" or ""
  style: string;
  notes: string;
  include: {
    scripture: boolean;
    examples: boolean;
    humor: boolean;
    illustrations: boolean;
    quotes: boolean;
    calltoaction: boolean;
  };
};

/** "John" + "3" + "1-10" -> "John 3:1-10 (ESV)", or "" when incomplete. */
export function formatPassage(book: string, chapter: string, verses: string): string {
  if (!book || !chapter) return "";
  return `${book} ${chapter}${verses ? `:${verses}` : ""} (ESV)`;
}

export function buildSermonPrompt(input: SermonPromptInput): string {
  const style = SERMON_STYLES.find((s) => s.value === input.style);

  let prompt = "Write a complete sermon based on the following details:\n\n";
  prompt += `Title: ${input.title || `A sermon from ${input.passage}`}\n`;
  if (input.passage) prompt += `Bible Passage: ${input.passage}\n`;
  if (style) prompt += `Style: ${style.description}\n`;
  prompt += `Target Audience: ${AUDIENCE}\n`;
  if (input.notes) prompt += `Additional Notes: ${input.notes}\n`;

  prompt += "\nSermon Structure (use clear headings and sections):\n";
  prompt += "1. Title + Big Idea\n";
  prompt += "2. Opening/Introduction\n";
  if (input.include.scripture) prompt += "3. Scripture Reading\n";
  prompt += "4. Main Teaching (3-4 main points with subpoints)\n";
  if (input.include.illustrations) prompt += "5. Illustrations/Stories\n";
  if (input.include.examples) prompt += "6. Life Applications\n";
  if (input.include.quotes) prompt += "7. Relevant Quotes\n";
  if (input.include.humor) prompt += "8. Light-hearted moments (appropriate)\n";
  prompt += "9. Conclusion\n";
  if (input.include.calltoaction) prompt += "10. Call to Action\n";

  prompt += "\nFormatting Requirements:\n";
  prompt += "- Use Markdown-style headings (## for sections, ### for subpoints).\n";
  prompt += "- Keep paragraphs short (2-4 sentences).\n";
  prompt += "- Use numbered points for main points, and bullet lists for application steps.\n";
  prompt += "- Set any quoted scripture reading as a Markdown blockquote (> ).\n";
  prompt += "- End with a short closing prayer.\n";
  prompt +=
    "\nMake this sermon approximately 2000-3000 words, engaging, biblical, and relevant to the audience.";

  return prompt;
}

export function summaryPrompt(sermon: string): string {
  return (
    "Create a concise public-facing summary of the sermon below for a church website. " +
    "Use 120-180 words. Format as 1-2 short paragraphs followed by 3 bullet takeaways. " +
    "Keep it warm, encouraging, and easy to read. Avoid emojis.\n\nSERMON:\n" + sermon
  );
}

export function devotionalPrompt(passage: string): string {
  return (
    `Write a short daily devotional (300-500 words) based on ${passage}. Include:\n` +
    "1. Scripture reading\n2. Brief reflection\n3. Prayer\n4. Application question\n\n" +
    `Make it suitable for a ${AUDIENCE}.`
  );
}

export function smallGroupPrompt(passage: string): string {
  return (
    `Create 5-7 discussion questions for a small group based on the sermon from ${passage}. ` +
    "Questions should encourage personal reflection and group discussion. " +
    `Make them suitable for a ${AUDIENCE}.`
  );
}

export function kidsPrompt(passage: string): string {
  return (
    `Create a children's ministry lesson plan for ages 4-12 based on ${passage}. Include:\n` +
    "1. Objective\n2. Bible Story Summary\n3. Key Verse\n4. Activity Ideas\n5. Craft/Song\n6. Prayer\n\n" +
    "Keep it simple and age-appropriate."
  );
}

export function bulletinPrompt(title: string, passage: string): string {
  return (
    `Write bulletin notes (150-250 words) for the sermon '${title}' from ${passage}. ` +
    "Include key points and scripture references. Make it suitable for church bulletin format."
  );
}

/* ---- The two add-ons WordPress never built. Approved 2026-09-03. ---- */

export function slidesPrompt(sermon: string): string {
  return (
    "Create presentation slides for the sermon below. Return ONLY valid JSON: an array of " +
    '8-12 slides, each {"title": string, "bullets": array of 2-4 short strings, "scripture": ' +
    "optional verse reference}. Slide 1 is the title slide (sermon title and passage). Give " +
    "each main point its own slide, each key scripture its own slide, and end with a closing " +
    "slide carrying the call to action. Keep every bullet under 12 words - slides support " +
    "the preacher, they do not replace him.\n\nSERMON:\n" + sermon
  );
}

export function socialPrompt(sermon: string): string {
  return (
    "Write social media posts announcing the sermon below for a church's own accounts. " +
    'Return ONLY valid JSON: {"facebook": 80-120 words, warm and inviting, ending with a ' +
    'question that draws comments, "instagram": 50-80 words with 3-5 hashtags on their own ' +
    'final line, "x": under 240 characters, punchy, "sms": under 160 characters of plain ' +
    "text for a text blast}. Mention the sermon title and passage naturally. Keep it " +
    "encouraging and easy to read. Avoid emojis.\n\nSERMON:\n" + sermon
  );
}

/**
 * Parse a JSON answer, tolerating the markdown fences Claude sometimes adds
 * despite "Return ONLY valid JSON". Throws on anything else - the caller's
 * per-section retry is the recovery path, never silent acceptance.
 */
export function parseJsonBlock(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(stripped);
}
