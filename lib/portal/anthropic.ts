import "server-only";

/**
 * ============================================================
 * ANTHROPIC CLIENT - the two call shapes the Sermon Builder needs
 * ============================================================
 *
 * Plain fetch against the Messages API rather than the SDK - the builder
 * uses exactly two shapes (stream one long completion; get one short
 * completion), and this file is smaller than the dependency it avoids.
 *
 * The key is ANTHROPIC_API_KEY - server-side only, no NEXT_PUBLIC_ prefix,
 * ever (ground rule 6). This module is "server-only" so importing it from
 * a Client Component fails the build instead of leaking a code path that
 * expects the key to exist in a browser.
 *
 * MODEL: claude-sonnet-5, chosen deliberately (2026-09-03 scope): a sermon
 * draft needs reliable long-form structure, not frontier reasoning - the
 * Opus tier is real money for no benefit here, and the Haiku tier is
 * noticeably weaker at holding a ten-part outline across 2,500 words. At
 * roughly $0.20 per full generation the 10/day cap bounds worst-case spend
 * near $2/church/day.
 *
 * NO `temperature` PARAMETER, AND DO NOT ADD ONE BACK. The WordPress
 * original sent temperature 0.6 and that value was ported here with the
 * rest of its tuning - which made every single generation fail in
 * production with:
 *
 *   400 invalid_request_error: `temperature` is deprecated for this model.
 *
 * Confirmed by replaying the exact request body against the live API on
 * 2026-09-03: identical request minus `temperature` succeeds on both the
 * streaming and non-streaming paths. The parameter is not optional-but-
 * ignored on this model, it is rejected outright, so re-adding it does not
 * make output more varied - it takes the feature down.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

export function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function headers(): HeadersInit {
  return {
    "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
    "anthropic-version": API_VERSION,
    "content-type": "application/json",
  };
}

/** One complete (non-streamed) generation. Throws on any failure - callers
    decide whether a section is retryable; this just reports honestly. */
export async function callClaude(
  prompt: string,
  options: { system: string; maxTokens: number },
): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic ${response.status}: ${body.slice(0, 1200)}`);
  }

  const data = (await response.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no text content");
  return text.trim();
}

/**
 * One streamed generation, as a stream of plain text chunks.
 *
 * Parses the Messages API's SSE frames server-side and re-emits only the
 * text deltas, so the route handler can pipe words to the browser as they
 * arrive - the whole reason generation does not look frozen.
 */
export async function streamClaude(
  prompt: string,
  options: { system: string; maxTokens: number },
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      model: MODEL,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic ${response.status}: ${body.slice(0, 1200)}`);
  }

  const upstream = response.body;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE frames are newline-delimited; a frame may split across
          // network chunks, so only lines before the last newline are safe
          // to parse - the tail stays in the buffer.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload) as {
                type?: string;
                delta?: { type?: string; text?: string };
                error?: { message?: string };
              };
              if (event.type === "error") {
                throw new Error(event.error?.message ?? "stream error");
              }
              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta" &&
                event.delta.text
              ) {
                controller.enqueue(encoder.encode(event.delta.text));
              }
            } catch (parseError) {
              // A malformed frame is dropped; a surfaced stream error ends
              // the response so the client sees a failure, not silence.
              if ((parseError as Error).message !== "Unexpected end of JSON input") {
                if (payload.includes('"error"')) throw parseError;
              }
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}
