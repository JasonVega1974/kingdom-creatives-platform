"use client";

import Image from "next/image";
import { useActionState, useRef, useState, useTransition } from "react";

import {
  mediaUsage,
  recordUpload,
  removeMedia,
  setInGallery,
  updateMedia,
} from "@/app/(portal)/portal/photos/actions";
import {
  ConfirmRemove,
  EmptyList,
  Field,
  SaveRow,
  TextArea,
} from "@/components/portal/editor-kit";
import { TEAM_IDLE } from "@/lib/portal/form-state";
import {
  ACCEPTED_MIME,
  formatBytes,
  JPEG_QUALITY,
  MAX_EDGE_PX,
  MAX_UPLOAD_BYTES,
  MEDIA_BUCKET,
  mediaPath,
  mediaUrl,
} from "@/lib/portal/media";
import { createClient } from "@/lib/supabase/client";

/**
 * ============================================================
 * PHOTOS - the media library
 * ============================================================
 *
 * Upload once here, use anywhere. Every other tab picks from this list rather
 * than uploading its own copy.
 *
 * THE FILE GOES STRAIGHT TO STORAGE FROM THE BROWSER, then a Server Action
 * records the row. The storage policies from draft 23 enforce the tenant
 * boundary on the path, so the browser upload is checked by the database just
 * as a server upload would be - and a few hundred KB does not need to be
 * encoded into a Server Action request body on the way past.
 *
 * EVERY PHOTO IS DOWNSCALED BEFORE IT LEAVES THE DEVICE. A phone photo is
 * 3-5MB; the audience is drivers on cell service at truck stops, uploading and
 * later downloading over the same connection. next/image already handles
 * DELIVERY - it serves a resized WebP at display size - but nothing else stops
 * a 5MB original being pushed up a slow uplink and stored forever. This does.
 */

export type MediaItem = {
  id: string;
  storagePath: string;
  title: string;
  altText: string;
  width: number | null;
  height: number | null;
  byteSize: number | null;
  inGallery: boolean;
};

export function PhotosManager({
  media,
  churchId,
}: {
  media: MediaItem[];
  churchId: string;
}) {
  return (
    <div className="space-y-6">
      <Uploader churchId={churchId} />

      {media.length === 0 ? (
        <EmptyList>
          No photos yet. Add one above, then you can use it on an event, a
          person, or your logo without uploading it again.
        </EmptyList>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------

type UploadStatus =
  | { phase: "idle" }
  | { phase: "working"; label: string }
  | { phase: "done"; saved: string }
  | { phase: "error"; message: string };

function Uploader({ churchId }: { churchId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>({ phase: "idle" });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const supabase = createClient();
    let savedBytes = 0;

    for (const file of Array.from(files)) {
      if (!(ACCEPTED_MIME as readonly string[]).includes(file.type)) {
        setStatus({
          phase: "error",
          message: `${file.name} is not a photo we can use. JPG, PNG, WebP or AVIF.`,
        });
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        setStatus({
          phase: "error",
          message: `${file.name} is ${formatBytes(file.size)} - too big even to shrink.`,
        });
        return;
      }

      try {
        setStatus({ phase: "working", label: `Shrinking ${file.name}...` });
        const resized = await downscale(file);

        setStatus({ phase: "working", label: `Uploading ${file.name}...` });
        const path = mediaPath(churchId, resized.fileName);

        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, resized.blob, {
            contentType: resized.mimeType,
            upsert: false,
          });

        if (uploadError) {
          setStatus({
            phase: "error",
            message: `${file.name} did not upload. ${uploadError.message}`,
          });
          return;
        }

        const result = await recordUpload({
          storagePath: path,
          title: file.name.replace(/\.[^.]+$/, ""),
          width: resized.width,
          height: resized.height,
          byteSize: resized.blob.size,
          mimeType: resized.mimeType,
        });

        if (!result.ok) {
          setStatus({ phase: "error", message: result.error ?? "That did not save." });
          return;
        }

        savedBytes += Math.max(0, file.size - resized.blob.size);
      } catch {
        setStatus({
          phase: "error",
          message: `${file.name} could not be read. Try a different photo.`,
        });
        return;
      }
    }

    if (inputRef.current) inputRef.current.value = "";
    setStatus({ phase: "done", saved: formatBytes(savedBytes) });
  }

  return (
    <section className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)] p-5">
      <label
        htmlFor="photo-upload"
        className="inline-block cursor-pointer rounded-[var(--kc-radius)] bg-[var(--kc-brand)] px-4 py-2 font-semibold text-[var(--kc-brand-contrast)]"
      >
        Add photos
      </label>
      <input
        ref={inputRef}
        id="photo-upload"
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        multiple
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <p className="mt-3 text-sm text-[var(--kc-ink-soft)]">
        Photos are shrunk on your phone before they upload, so this works on a
        slow connection. You can pick several at once.
      </p>

      {status.phase === "working" ? (
        <p role="status" className="mt-3 text-sm text-[var(--kc-ink-soft)]">
          {status.label}
        </p>
      ) : null}
      {status.phase === "done" ? (
        <p role="status" className="mt-3 text-sm text-[var(--kc-ink-soft)]">
          Uploaded. Saved {status.saved} of data by shrinking first.
        </p>
      ) : null}
      {status.phase === "error" ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {status.message}
        </p>
      ) : null}
    </section>
  );
}

function MediaCard({ item }: { item: MediaItem }) {
  const [state, action] = useActionState(updateMedia, TEAM_IDLE);
  const [open, setOpen] = useState(false);
  const [inGallery, setGallery] = useState(item.inGallery);
  const [, startTransition] = useTransition();
  const [usage, setUsage] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)] bg-[var(--kc-surface)]">
      <Image
        src={mediaUrl(item.storagePath)}
        alt={item.altText || item.title || ""}
        width={item.width ?? 400}
        height={item.height ?? 300}
        className="aspect-[4/3] w-full object-cover"
      />

      <div className="p-4">
        <p className="truncate font-medium">{item.title || "Untitled"}</p>
        <p className="text-xs text-[var(--kc-ink-soft)]">
          {[
            item.width && item.height ? `${item.width}x${item.height}` : null,
            item.byteSize ? formatBytes(item.byteSize) : null,
          ]
            .filter(Boolean)
            .join(" - ")}
        </p>

        {!item.altText ? (
          <p className="mt-2 text-xs text-[var(--kc-ink-soft)]">
            No description yet - add one so screen readers can describe it.
          </p>
        ) : null}

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={inGallery}
            onChange={() => {
              const next = !inGallery;
              setGallery(next);
              startTransition(async () => {
                const result = await setInGallery(item.id, next);
                if (!result.ok) setGallery(!next);
              });
            }}
            className="h-4 w-4 accent-[var(--kc-brand)]"
          />
          <span className="text-[var(--kc-ink-soft)]">Show in photo gallery</span>
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : "Edit"}
          </button>

          <ConfirmRemove
            itemName={item.title || "this photo"}
            note={usage ?? undefined}
            onRemove={() => removeMedia(item.id)}
          />

          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                const counts = await mediaUsage(item.id);
                const total =
                  counts.events + counts.staff + counts.groups + counts.logo;
                setUsage(
                  total === 0
                    ? "Not used anywhere. Delete it?"
                    : `Used in ${total} place${total === 1 ? "" : "s"} - they will lose this photo. Delete it?`,
                );
              })
            }
            className="text-xs text-[var(--kc-ink-soft)] underline underline-offset-4"
          >
            Where is this used?
          </button>
        </div>

        {open ? (
          <form action={action} className="mt-4 space-y-3 border-t border-[var(--kc-line)] pt-4">
            <input type="hidden" name="id" value={item.id} />
            {inGallery ? <input type="hidden" name="in_gallery" value="on" /> : null}

            <Field name="title" label="Name" defaultValue={item.title} />
            <TextArea
              name="alt_text"
              label="Describe it"
              defaultValue={item.altText}
              rows={2}
            />
            <SaveRow label="Save" state={state} />
          </form>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------

type Resized = {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
  fileName: string;
};

/**
 * Downscale to MAX_EDGE_PX on the longest side and re-encode as JPEG.
 *
 * createImageBitmap + canvas rather than an <img> and onload: it decodes off
 * the main thread, which on a mid-range phone is the difference between a
 * momentary pause and a visibly frozen page.
 *
 * An image already inside the limit is still re-encoded. That looks wasteful
 * and is not: a 1200px photo straight off a phone still carries EXIF, which
 * includes GPS coordinates. Re-encoding through a canvas drops all of it, and a
 * church photo should not publish where it was taken.
 */
async function downscale(file: File): Promise<Resized> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new Error("encode failed");

  return {
    blob,
    width,
    height,
    mimeType: "image/jpeg",
    fileName: file.name.replace(/\.[^.]+$/, ".jpg"),
  };
}
