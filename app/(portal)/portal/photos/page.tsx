import type { Metadata } from "next";

import { PhotosManager, type MediaItem } from "@/components/portal/photos-manager";
import { requirePortalUser } from "@/lib/portal/auth";
import { createClient } from "@/lib/supabase/server";
import { HelpMark } from "@/components/portal/help-mark";

export const metadata: Metadata = { title: "Photos" };

/**
 * "Photos" - the media library.
 *
 * The one place a photo is uploaded. Events, Our Team and the Church Details
 * logo pick from here rather than uploading their own copy, so the same picture
 * is never stored three times.
 *
 * Newest first: the photo someone just uploaded is the one they are looking
 * for.
 */
export default async function PhotosPage() {
  const session = await requirePortalUser();

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("church_media")
    .select("id, storage_path, title, alt_text, width, height, byte_size, in_gallery")
    .eq("church_id", session.site.church.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <Shell>
        <p role="alert" className="text-red-700">
          Your photos could not be loaded right now. Refresh the page - nothing
          has been lost.
        </p>
      </Shell>
    );
  }

  const media: MediaItem[] = (rows ?? []).map((row) => ({
    id: row.id,
    storagePath: row.storage_path,
    title: row.title ?? "",
    altText: row.alt_text ?? "",
    width: row.width,
    height: row.height,
    byteSize: row.byte_size,
    inGallery: row.in_gallery,
  }));

  return (
    <Shell>
      {/* church_id is needed in the browser to build the upload path. It is not
          a secret - the storage policy checks it against church_members, so a
          client cannot use another church's id even by editing it. */}
      <PhotosManager media={media} churchId={session.site.church.id} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2.5">
        <h1 className="font-[family-name:var(--kc-font-display)] text-3xl font-bold">
          Photos
        </h1>
        <HelpMark topic="photos.upload" />
      </div>
      <p className="mt-2 mb-7 text-[var(--kc-ink-soft)]">
        Every picture you upload lives here. Add it once, then use it on an
        event, a person, or your logo - you never need to upload the same photo
        twice.
      </p>

      {children}
    </div>
  );
}
