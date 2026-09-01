import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  /*
   * EXPERIMENTAL, AND LOAD-BEARING. See FF-52.
   *
   * Enables React's <ViewTransition> integration, which is what gives the
   * Bible reader a directional page-turn between chapters. Without this flag
   * the <ViewTransition> in components/site/scripture.tsx is inert and the
   * reader falls back to the CSS slide from the previous commit - a working
   * page, just a plainer transition.
   *
   * It is marked experimental by Next and rides on React canary. It is
   * isolated in its own commit for exactly that reason: dropping that commit
   * removes the flag and the wrapper together and restores the plain baseline.
   */
  experimental: {
    viewTransition: true,
  },

  images: {
    remotePatterns: [
      // Supabase Storage: the public `gallery` bucket (logos, hero images).
      // The private `documents` bucket is served through signed URLs, never
      // through next/image.
      ...(supabaseHost
        ? ([
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ])
        : []),
      // YouTube thumbnails for the sermon facade player (Phase B).
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
