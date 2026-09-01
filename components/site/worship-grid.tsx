import { SermonPlayer } from "@/components/site/sermon-player";
import type { WorshipSong } from "@/lib/worship-playlist";

/**
 * ============================================================
 * WORSHIP GRID
 * ============================================================
 *
 * Takes a list of songs and knows nothing about where they came from. That is
 * deliberate: lib/worship-playlist.ts is Church for Truckers' seed set living
 * in code until there is a per-church table, and when that table arrives this
 * component does not change - only its caller does.
 *
 * THE PLAYER IS THE SERMON FACADE, NOT A SECOND ONE. Every card mounts
 * <SermonPlayer>, so a thumbnail shows until someone clicks and nothing is
 * requested from YouTube before then. That matters beyond performance: the
 * church's own cookie policy states that no player loads until you press play,
 * and thirty live iframes on one page would make that sentence false.
 */
export function WorshipGrid({
  songs,
  heading,
}: {
  songs: WorshipSong[];
  heading?: string;
}) {
  if (songs.length === 0) return null;

  return (
    <section>
      {heading ? (
        <div style={{ marginBottom: "18px" }}>
          <span className="eyebrow">{heading}</span>
        </div>
      ) : null}

      <div className="cardgrid">
        {songs.map((song) => (
          <article key={song.id} className="card worship-card">
            <SermonPlayer
              youtubeId={song.id}
              title={`${song.title} - ${song.artist}`}
              variant="player-sm"
            />

            <div className="card-body">
              <h3>{song.title}</h3>
              {/* Artist and duration are hand-written metadata carried over
                  from the source list. YouTube's API returns neither in this
                  form, so if they are dropped they cannot be recovered. */}
              <p className="where">
                {[song.artist, song.duration].filter(Boolean).join(" - ")}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
