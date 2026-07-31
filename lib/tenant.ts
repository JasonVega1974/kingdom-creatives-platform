/**
 * ============================================================
 * TENANT RESOLUTION - hostname -> church
 * ============================================================
 *
 * Runs in proxy.ts (the Next 16 successor to middleware.ts) on every request,
 * so it deliberately avoids `next/headers`, supabase-js and anything else that
 * would bloat the edge bundle. Plain fetch against PostgREST with the anon key.
 *
 * IMPORTANT: this module must stay importable from the edge runtime. Server
 * Component data access lives in lib/church.ts instead.
 *
 * The resolved church id is handed to Server Components through request
 * headers. A client never supplies a church id - see ground rule in
 * BUILD_BRIEF section 1.
 */

/** Request headers the proxy stamps and Server Components read. */
export const CHURCH_ID_HEADER = "x-church-id";
export const CHURCH_SLUG_HEADER = "x-church-slug";
export const CHURCH_HOST_HEADER = "x-church-host";

export type ResolvedTenant = {
  id: string;
  slug: string;
  name: string | null;
  status: string;
  /** Which rule matched - surfaced in dev to make misrouting obvious. */
  source: "query-override" | "subdomain" | "custom-domain" | "default-fallback";
};

/**
 * Lowercase, drop the port, drop a trailing dot, drop a leading "www.".
 * "WWW.ChurchForTruckers.org:3000" -> "churchfortruckers.org"
 */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host
    .trim()
    .toLowerCase()
    .split(",")[0] // an upstream proxy may append a comma-joined chain
    .trim()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
}

/** Hosts that never belong to a tenant and should fall back to the default. */
export function isPlatformHost(host: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "127.0.0.1" || host === "0.0.0.0" || host === "[::1]") return true;
  if (host.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * Hosts we are willing to interpolate into a PostgREST filter.
 *
 * encodeURIComponent leaves "(", ")", "'", "*", "!" and "." unescaped, and the
 * custom-domain lookup puts the host inside an or=(...) group - so a crafted
 * Host header could otherwise restructure the filter rather than just fail to
 * match. After normalizeHost a real hostname only ever needs [a-z0-9.-], so
 * anything else is refused before a query is built instead of escaped after.
 */
const HOST_CHARSET = /^[a-z0-9.-]+$/;

export function isQueryableHost(host: string): boolean {
  return HOST_CHARSET.test(host);
}

/**
 * If host is "{slug}.{root}", return the slug. Otherwise null.
 * Multi-level subdomains ("a.b.root") are rejected - they are not tenants.
 */
export function subdomainSlug(host: string, rootDomain: string): string | null {
  const root = normalizeHost(rootDomain);
  if (!root || !host.endsWith(`.${root}`)) return null;

  const label = host.slice(0, -(root.length + 1));
  if (!label || label.includes(".") || label === "www") return null;
  return label;
}

// ---------------------------------------------------------------
// Lookup cache. This runs on every request, so an uncached lookup
// would mean a Supabase round trip per page view (BUILD_BRIEF 1).
// Per-instance in-memory, short TTL - a domain change propagates within
// a minute without any invalidation plumbing.
//
// Next's proxy docs warn against relying on shared globals, and that holds:
// this is best-effort only. A cold instance, a CDN-served proxy, or an
// evicted entry just means one extra Supabase round trip - never a wrong
// answer. Nothing depends on the cache being warm or shared.
// ---------------------------------------------------------------
type CacheEntry = { tenant: ResolvedTenant | null; expiresAt: number };

const HIT_TTL_MS = 60_000;
const MISS_TTL_MS = 15_000; // shorter, so a newly added domain goes live fast
const cache = new Map<string, CacheEntry>();

function readCache(key: string): CacheEntry | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

function writeCache(key: string, tenant: ResolvedTenant | null): void {
  cache.set(key, {
    tenant,
    expiresAt: Date.now() + (tenant ? HIT_TTL_MS : MISS_TTL_MS),
  });
}

/** Exposed for tests and for a future admin "clear tenant cache" action. */
export function clearTenantCache(): void {
  cache.clear();
}

const SELECT = "id,slug,name,status";

type ChurchRow = Omit<ResolvedTenant, "source">;

/**
 * "No such church" and "could not ask" are different answers and must not
 * collapse into the same null. Only the first is a cacheable fact.
 */
type ChurchQueryResult = { ok: true; row: ChurchRow | null } | { ok: false };

async function queryChurch(filter: string): Promise<ChurchQueryResult> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Missing config is a deployment problem, not evidence about this hostname.
  if (!baseUrl || !anonKey) return { ok: false };

  const url = `${baseUrl}/rest/v1/churches?select=${SELECT}&${filter}&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };

    const rows = (await res.json()) as ChurchRow[];
    return { ok: true, row: rows[0] ?? null };
  } catch {
    // Network blip or unparseable body: unresolved for this request only,
    // rather than throwing on every request or being remembered as a miss.
    return { ok: false };
  }
}

/**
 * Resolve the tenant for a request.
 *
 * Order:
 *   1. ?church=<slug>  - only when KC_ALLOW_CHURCH_QUERY_OVERRIDE=1
 *                        (preview/dev; never set in production)
 *   2. {slug}.KC_ROOT_DOMAIN subdomain
 *   3. churches.custom_domain exact match
 *   4. KC_DEFAULT_CHURCH_SLUG - only for platform hosts (localhost,
 *      *.vercel.app). A real unmatched domain resolves to null so it 404s
 *      instead of silently serving another church's content.
 *
 * Rules 2 and 3 derive their filter from the Host header, so they only run for
 * a host that passes isQueryableHost. Rule 4's slug comes from the environment,
 * not the request, so an empty or rejected host still reaches the fallback.
 */
export async function resolveTenant(
  rawHost: string | null | undefined,
  overrideSlug?: string | null,
): Promise<ResolvedTenant | null> {
  const host = normalizeHost(rawHost);
  const rootDomain = process.env.KC_ROOT_DOMAIN ?? "";
  const allowOverride = process.env.KC_ALLOW_CHURCH_QUERY_OVERRIDE === "1";
  const defaultSlug = process.env.KC_DEFAULT_CHURCH_SLUG ?? "";

  const cacheKey = `${host}|${allowOverride ? (overrideSlug ?? "") : ""}`;
  const cached = readCache(cacheKey);
  if (cached) return cached.tenant;

  // A host that cannot be safely interpolated is not queried at all. It can
  // still reach rule 4, whose filter comes from the environment.
  const hostIsQueryable = isQueryableHost(host);

  let tenant: ResolvedTenant | null = null;
  let lookupFailed = false;

  // 1. explicit preview override
  if (!tenant && allowOverride && overrideSlug) {
    const result = await queryChurch(`slug=eq.${encodeURIComponent(overrideSlug)}`);
    if (!result.ok) lookupFailed = true;
    else if (result.row) tenant = { ...result.row, source: "query-override" };
  }

  // 2. subdomain of the platform apex
  if (!tenant && rootDomain && hostIsQueryable) {
    const slug = subdomainSlug(host, rootDomain);
    if (slug) {
      const result = await queryChurch(`slug=eq.${encodeURIComponent(slug)}`);
      if (!result.ok) lookupFailed = true;
      else if (result.row) tenant = { ...result.row, source: "subdomain" };
    }
  }

  // 3. custom domain
  if (!tenant && host && hostIsQueryable && !isPlatformHost(host)) {
    const result = await queryChurch(
      `or=(custom_domain.eq.${encodeURIComponent(host)},custom_domain.eq.${encodeURIComponent(`www.${host}`)})`,
    );
    if (!result.ok) lookupFailed = true;
    else if (result.row) tenant = { ...result.row, source: "custom-domain" };
  }

  // 4. preview/dev fallback
  if (!tenant && defaultSlug && isPlatformHost(host)) {
    const result = await queryChurch(`slug=eq.${encodeURIComponent(defaultSlug)}`);
    if (!result.ok) lookupFailed = true;
    else if (result.row) tenant = { ...result.row, source: "default-fallback" };
  }

  // Only remember an answer the database actually gave. Caching a failed
  // lookup would turn one Supabase blip into MISS_TTL_MS of 404s on a live
  // church domain; the miss TTL covers "no such church", not "could not ask".
  if (tenant || !lookupFailed) writeCache(cacheKey, tenant);

  return tenant;
}
