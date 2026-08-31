"use client";

import Image from "next/image";
import { useId, useState } from "react";

import { mediaUrl } from "@/lib/portal/media";

/**
 * ============================================================
 * MEDIA PICKER - choose from the library, never upload here
 * ============================================================
 *
 * Used by Events, Our Team and the Church Details logo. Uploading happens in
 * ONE place, the Photos tab; every other tab picks. That is the whole point of
 * the library - a pastor should not upload the same photo three times because
 * three forms each offered him a file box.
 *
 * Posts a `media_id` into the surrounding form through a hidden input, so the
 * Server Action reads it like any other field and there is no client state to
 * keep in step with the form.
 *
 * An empty value means "no photo", which the actions translate to NULL rather
 * than to "leave it as it was". Clearing is a thing a pastor must be able to
 * do.
 */

export type LibraryItem = {
  id: string;
  storagePath: string;
  title: string;
  altText: string;
};

export function MediaPicker({
  name,
  label,
  library,
  value,
  fallbackUrl,
}: {
  /** Form field name - `media_id`, or `logo_media_id` for the theme. */
  name: string;
  label: string;
  library: LibraryItem[];
  /** Currently selected library item, if any. */
  value?: string | null;
  /**
   * A hand-pasted URL from the legacy *_url column, shown when nothing from
   * the library is selected. See FF-40: media_id wins, the URL is the
   * fallback, and choosing here is what retires it.
   */
  fallbackUrl?: string;
}) {
  const id = useId();
  const [selected, setSelected] = useState<string | null>(value ?? null);
  const [open, setOpen] = useState(false);

  const current = library.find((item) => item.id === selected) ?? null;

  return (
    <div>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input type="hidden" name={name} value={selected ?? ""} />

      <div className="flex flex-wrap items-start gap-4">
        <Preview current={current} fallbackUrl={fallbackUrl} />

        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((value) => !value)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : current ? "Change photo" : "Choose a photo"}
          </button>

          {selected ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-sm text-[var(--kc-ink-soft)] underline underline-offset-4"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div
          id={id}
          className="mt-4 rounded-[var(--kc-radius)] border border-[var(--kc-line)] p-3"
        >
          {library.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--kc-ink-soft)]">
              No photos yet. Add some in the Photos tab, then come back here.
            </p>
          ) : (
            <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {library.map((item) => {
                const isSelected = item.id === selected;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelected(item.id);
                        setOpen(false);
                      }}
                      className={
                        isSelected
                          ? "block w-full overflow-hidden rounded-[var(--kc-radius)] ring-2 ring-[var(--kc-brand)]"
                          : "block w-full overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)]"
                      }
                    >
                      <Image
                        src={mediaUrl(item.storagePath)}
                        alt={item.altText || item.title || "Library photo"}
                        width={160}
                        height={120}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Preview({
  current,
  fallbackUrl,
}: {
  current: LibraryItem | null;
  fallbackUrl?: string;
}) {
  if (current) {
    return (
      <Image
        src={mediaUrl(current.storagePath)}
        alt={current.altText || current.title || ""}
        width={128}
        height={96}
        className="aspect-[4/3] w-32 rounded-[var(--kc-radius)] border border-[var(--kc-line)] object-cover"
      />
    );
  }

  if (fallbackUrl) {
    return (
      <div className="w-32">
        {/* Unoptimized: a hand-pasted URL can point anywhere, and next/image
            throws on a host that is not allow-listed. Library images go
            through next/image normally - this branch only exists until the
            legacy columns are retired (FF-40). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fallbackUrl}
          alt=""
          className="aspect-[4/3] w-32 rounded-[var(--kc-radius)] border border-[var(--kc-line)] object-cover"
        />
        <p className="mt-1 text-xs text-[var(--kc-ink-soft)]">
          Pasted link - choose from your library to replace it
        </p>
      </div>
    );
  }

  return (
    <div className="flex aspect-[4/3] w-32 items-center justify-center rounded-[var(--kc-radius)] border border-dashed border-[var(--kc-line)] text-xs text-[var(--kc-ink-soft)]">
      No photo
    </div>
  );
}

/**
 * ============================================================
 * MEDIA URL FIELD - the picker for section content images
 * ============================================================
 *
 * A section's image lives in `church_sections.content` as a URL string, not as
 * a media_id: the content column is jsonb the pastor edits field by field, and
 * there is no FK to hang a composite reference on. So this picker writes the
 * library item's PUBLIC URL rather than its id.
 *
 * That is a deliberate difference from MediaPicker above, which posts a
 * media_id into a form. Both exist because the two storage shapes are
 * genuinely different, not by accident.
 *
 * The text box stays. A pasted link from anywhere still works - some churches
 * will have a logo hosted elsewhere - and removing it would take away an
 * option the field already had. The picker is the easy path, not the only one.
 */
export function MediaUrlField({
  id,
  value,
  library,
  onChange,
  className,
}: {
  id: string;
  value: string;
  library: LibraryItem[];
  onChange: (next: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3">
        {value ? (
          /* Unoptimized: the value can be any URL, and next/image throws on a
             host that is not allow-listed. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="aspect-[4/3] w-28 rounded-[var(--kc-radius)] border border-[var(--kc-line)] object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-28 items-center justify-center rounded-[var(--kc-radius)] border border-dashed border-[var(--kc-line)] text-xs text-[var(--kc-ink-soft)]">
            No photo
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="rounded-[var(--kc-radius)] border border-[var(--kc-line)] px-3 py-1.5 text-sm"
          >
            {open ? "Close" : value ? "Change photo" : "Choose a photo"}
          </button>

          {value ? (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-sm text-[var(--kc-ink-soft)] underline underline-offset-4"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-3 rounded-[var(--kc-radius)] border border-[var(--kc-line)] p-3">
          {library.length === 0 ? (
            <p className="py-3 text-center text-sm text-[var(--kc-ink-soft)]">
              No photos yet. Add some in the Photos tab, then come back here.
            </p>
          ) : (
            <ul className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {library.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(mediaUrl(item.storagePath));
                      setOpen(false);
                    }}
                    className="block w-full overflow-hidden rounded-[var(--kc-radius)] border border-[var(--kc-line)]"
                  >
                    <Image
                      src={mediaUrl(item.storagePath)}
                      alt={item.altText || item.title || "Library photo"}
                      width={160}
                      height={120}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="or paste a photo link"
        className={className}
      />
    </div>
  );
}
