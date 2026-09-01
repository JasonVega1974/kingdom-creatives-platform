"use client";

import { useState } from "react";

/**
 * ============================================================
 * SERMON PLAYER - facade, then a real embed
 * ============================================================
 *
 * A YouTube <iframe> is expensive: roughly half a megabyte of script and a
 * dozen requests to Google, paid on every page load by every visitor, most of
 * whom never press play. On a site whose audience is drivers on phone data at a
 * truck stop, that is not a rounding error.
 *
 * So this renders the thumbnail as a facade and mounts the real iframe only on
 * click. Nothing from YouTube is requested until someone actually wants the
 * video, and the page still costs one image.
 *
 * IT DEGRADES TO WHAT IT REPLACED. The facade is a real <a href> to the watch
 * page, and the click handler calls preventDefault() only after deciding to
 * play. With JavaScript off, or before hydration, clicking opens YouTube in a
 * new tab - exactly the old behaviour. Nobody gets a dead thumbnail.
 *
 * `youtube-nocookie.com` is deliberate: no tracking cookie is set unless the
 * visitor plays the video, which is the same bargain as not loading the iframe.
 */
export function SermonPlayer({
  youtubeId,
  title,
  badge,
  variant,
}: {
  youtubeId: string;
  title: string;
  /** "LATEST - SYNCED FROM YOUTUBE", from the section content. */
  badge?: string;
  /**
   * An extra class on the frame. The worship grid uses it to soften the heavy
   * drop shadow that suits one large player in a dark band but not thirty
   * small ones on a light page. The facade behaviour is untouched - this is
   * the same component, not a second copy of it.
   */
  variant?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className={variant ? `player is-playing ${variant}` : "player is-playing"}>
        <iframe
          /* autoplay because the click WAS the play instruction - landing on a
             paused player would make the first click do nothing visible. */
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <a
      className={variant ? `player ${variant}` : "player"}
      href={`https://www.youtube.com/watch?v=${youtubeId}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Play ${title}`}
      onClick={(event) => {
        // Let modified clicks through - ctrl/cmd/middle-click means "open in a
        // new tab", and hijacking that is the kind of thing people hate.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        setPlaying(true);
      }}
    >
      {/* Next/Image would need i.ytimg.com in remotePatterns and buys little
          here: one fixed-size thumbnail, already CDN-served by Google. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="thumb"
        src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`}
        alt=""
        loading="lazy"
      />
      {badge ? <span className="badge">{badge}</span> : null}
      <span className="play-ring">
        <span className="disc">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M8 5v14l11-7L8 5Z" />
          </svg>
        </span>
      </span>
    </a>
  );
}
