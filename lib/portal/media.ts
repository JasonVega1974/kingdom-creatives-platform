/**
 * ============================================================
 * MEDIA LIBRARY - paths, URLs and limits
 * ============================================================
 *
 * Shared by the browser (which uploads) and the server (which records the
 * row), so this file is deliberately NOT server-only and reads no secrets.
 *
 * The database stores `storage_path`, never a URL. A URL embeds the project
 * ref and the public path shape, both deployment details - keeping the path
 * means a project move is a config change rather than a data migration.
 */

export const MEDIA_BUCKET = "church-media";

/**
 * Longest edge after the client-side downscale.
 *
 * 2000px covers a full-bleed hero on a high-density desktop screen. next/image
 * takes it down from there per breakpoint, so nothing larger is ever displayed
 * and anything larger is bandwidth a driver pays for at a truck stop.
 */
export const MAX_EDGE_PX = 2000;

/** JPEG quality for the downscale. 0.82 is the usual knee before artefacts. */
export const JPEG_QUALITY = 0.82;

/**
 * Refused before the file is read.
 *
 * The bucket enforces the same list, and that is the boundary - this is the
 * message a pastor sees instead of a failed upload. SVG is excluded on both
 * sides: it is a script container, and one served from our own origin in a
 * public bucket is a stored-XSS vector.
 */
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

/** Backstop against a mistake. The downscale is what actually keeps files small. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Public URL for a stored object.
 *
 * Built rather than fetched: getPublicUrl() is a pure string join in
 * supabase-js, and doing it here keeps the shape in one place and lets a
 * Server Component render an image without constructing a client.
 */
export function mediaUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/${MEDIA_BUCKET}/${storagePath}`;
}

/**
 * Where a church's files live: {church_id}/{uuid}.{ext}
 *
 * The first segment IS the tenant boundary - the storage policies from draft 23
 * check `(storage.foldername(name))[1]` against church_members. Anything that
 * builds a path must go through here so that invariant has one home.
 */
export function mediaPath(churchId: string, fileName: string): string {
  const ext = extensionFor(fileName);
  // crypto.randomUUID exists in both the browser and Node 19+.
  return `${churchId}/${crypto.randomUUID()}${ext}`;
}

/** Whether a path belongs to this church. Cheap, and checked server-side too. */
export function pathBelongsTo(storagePath: string, churchId: string): boolean {
  return storagePath.startsWith(`${churchId}/`);
}

/**
 * Lower-cased extension including the dot, or ".jpg".
 *
 * The downscale re-encodes to JPEG, so the stored extension is usually .jpg
 * regardless of what was dropped in. This exists for the passthrough case
 * where a file is already small enough to skip re-encoding.
 */
function extensionFor(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.(jpe?g|png|webp|avif)$/);
  return match ? match[0] : ".jpg";
}

/** "2.4 MB". For the upload preview, so a pastor sees the saving. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
