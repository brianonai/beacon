// Small typed wrapper for the FastAPI calls.
// Cookies flow naturally because Next.js rewrites proxy /api and /auth same-origin.

export type PropertyType = "DOMAIN" | "URL_PREFIX";

export type Property = {
  site_url: string;
  type: PropertyType;
  permission_level: string;
};

export type DiscoveredSitemap = {
  url: string;
  source: "robots" | "default" | "index" | "user";
  url_count: number;
};

export type DiscoverResponse = {
  sitemaps: DiscoveredSitemap[];
  total_urls: number;
  sample_urls: string[];
};

export type IndexState =
  | "INDEXED"
  | "UNKNOWN"
  | "DISCOVERED"
  | "CRAWLED_NOT_INDEXED"
  | "EXCLUDED"
  | "ERROR"
  | "PENDING";

export type PageCheck = {
  status_code: number | null;
  final_url: string | null;
  redirect_count: number;
  response_time_ms: number | null;
  content_type: string | null;
  error: string | null;
};

export type UrlResult = {
  url: string;
  in_sitemap: boolean;
  sitemap_lastmod?: string | null;
  index_state: IndexState;
  coverage_state?: string | null;
  last_crawled?: string | null;
  last_indexed?: string | null;
  page_fetch_state?: string | null;
  robots_txt_state?: string | null;
  issues: string[];
  inspection_url?: string | null;
  page_check?: PageCheck | null;
};

export type ScanSummary = {
  total: number;
  indexed: number;
  unknown: number;
  discovered: number;
  crawled_not_indexed: number;
  excluded: number;
  errors: number;
  stale: number;
  duration_ms: number;
  phantom_count?: number;
};

export type SitePreview = {
  title?: string | null;
  description?: string | null;
  screenshot_url?: string | null;
  logo_url?: string | null;
  error?: string | null;
  requested_url?: string | null;
  resolved_url?: string | null;
  resolve_note?: string | null;
  microlink_errors?: string[];
  last_microlink_query?: string | null;
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export const api = {
  me: () => get<{ authenticated: boolean }>("/auth/me"),
  logout: () =>
    fetch("/auth/logout", { method: "POST", credentials: "include" }),
  properties: () => get<{ properties: Property[] }>("/api/properties"),
  discover: (property_url: string, paste_sitemap_url?: string) =>
    post<DiscoverResponse>("/api/discover", { property_url, paste_sitemap_url }),
  preview: (url: string) =>
    get<SitePreview>(`/api/preview?url=${encodeURIComponent(url)}`),
};
