import type { ScanSummary, SitePreview, UrlResult } from "./api";

const SCHEMA_VERSION = 1;
const PREFIX = "beacon:scan:";

export type CachedScan = {
  rows: UrlResult[];
  summary: ScanSummary;
  preview: SitePreview | null;
  scannedAt: string;
  schemaVersion: number;
};

function key(property: string, sitemap: string): string {
  return `${PREFIX}${property}:${sitemap}`;
}

export function loadCached(property: string, sitemap: string): CachedScan | null {
  try {
    const raw = localStorage.getItem(key(property, sitemap));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedScan;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveScan(
  property: string,
  sitemap: string,
  data: Omit<CachedScan, "scannedAt" | "schemaVersion">,
  scannedAt: string = new Date().toISOString(),
): void {
  try {
    const payload: CachedScan = {
      ...data,
      scannedAt,
      schemaVersion: SCHEMA_VERSION,
    };
    localStorage.setItem(key(property, sitemap), JSON.stringify(payload));
  } catch (e) {
    console.warn("Beacon: could not cache scan", e);
  }
}

export function clearScan(property: string, sitemap: string): void {
  try {
    localStorage.removeItem(key(property, sitemap));
  } catch {
    /* ignore */
  }
}

/** Human-readable "X ago" formatter for the banner. */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  const days = Math.floor(seconds / 86400);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}
