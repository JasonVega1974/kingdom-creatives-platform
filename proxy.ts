import { NextResponse, type NextRequest } from "next/server";

import {
  CHURCH_HOST_HEADER,
  CHURCH_ID_HEADER,
  CHURCH_SLUG_HEADER,
  normalizeHost,
  resolveTenant,
} from "@/lib/tenant";

/**
 * ============================================================
 * TENANT PROXY - hostname -> church_id
 * ============================================================
 *
 * BUILD_BRIEF section 2 calls this file `middleware.ts`. Next 16 renamed the
 * convention to `proxy.ts`; `middleware.ts` still works but logs a deprecation
 * warning on every build. Same API, same request-time position - only the
 * filename and the exported function name changed.
 *
 * Responsibility is deliberately narrow: resolve the tenant, stamp it on the
 * request headers, get out of the way. No auth, no redirects, no rewrites yet.
 *
 * Headers are stripped from the incoming request first, so a client cannot
 * forge x-church-id and read another church's data.
 */
export async function proxy(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";

  const overrideSlug = request.nextUrl.searchParams.get("church");
  const tenant = await resolveTenant(host, overrideSlug);

  const requestHeaders = new Headers(request.headers);

  // Never let an inbound value survive - these are ours to set.
  requestHeaders.delete(CHURCH_ID_HEADER);
  requestHeaders.delete(CHURCH_SLUG_HEADER);
  requestHeaders.delete(CHURCH_HOST_HEADER);

  if (tenant) {
    requestHeaders.set(CHURCH_ID_HEADER, tenant.id);
    requestHeaders.set(CHURCH_SLUG_HEADER, tenant.slug);
    requestHeaders.set(CHURCH_HOST_HEADER, normalizeHost(host));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Response-side echo, dev only: makes "which church am I looking at, and
  // which rule matched?" answerable from the network tab.
  if (process.env.NODE_ENV !== "production" && tenant) {
    response.headers.set("x-kc-tenant", `${tenant.slug} (${tenant.source})`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets. Tenant resolution
     * is cached, but there is no reason to run it for a favicon.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
