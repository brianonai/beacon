"use client";

import { useMemo, useState } from "react";
import type { UrlResult, IndexState } from "@/lib/api";

type Filter =
  | "all"
  | "indexed"
  | "unknown"
  | "discovered"
  | "crawled_not_indexed"
  | "excluded"
  | "errors"
  | "phantom"
  | "stale_index"
  | "stale";

const STATE_STYLES: Record<IndexState, { dot: string; label: string }> = {
  INDEXED: { dot: "bg-live", label: "Indexed" },
  UNKNOWN: { dot: "bg-fail", label: "Unknown" },
  DISCOVERED: { dot: "bg-warn", label: "Discovered" },
  CRAWLED_NOT_INDEXED: { dot: "bg-warn", label: "Crawled, not indexed" },
  EXCLUDED: { dot: "bg-smoke", label: "Excluded" },
  ERROR: { dot: "bg-fail", label: "Error" },
  PENDING: { dot: "bg-rule", label: "Pending" },
};

const STALE_DAYS = 180;

export function ResultsTable({ rows }: { rows: UrlResult[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const now = Date.now();
    const staleMs = STALE_DAYS * 86_400_000;
    const q = query.trim().toLowerCase();

    return rows.filter((r) => {
      if (q && !r.url.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "indexed":
          return r.index_state === "INDEXED";
        case "unknown":
          return r.index_state === "UNKNOWN";
        case "discovered":
          return r.index_state === "DISCOVERED";
        case "crawled_not_indexed":
          return r.index_state === "CRAWLED_NOT_INDEXED";
        case "excluded":
          return r.index_state === "EXCLUDED";
        case "errors":
          return r.index_state === "ERROR";
        case "phantom":
          return (
            r.page_check?.status_code === 404 &&
            r.index_state !== "INDEXED"
          );
        case "stale_index":
          return (
            r.index_state === "INDEXED" &&
            r.page_check?.status_code != null &&
            r.page_check.status_code >= 400
          );
        case "stale":
          if (!r.last_crawled) return false;
          return now - new Date(r.last_crawled).getTime() > staleMs;
        default:
          return true;
      }
    });
  }, [rows, filter, query]);

  const counts = useMemo(() => {
    const stale = (r: UrlResult) =>
      r.last_crawled
        ? Date.now() - new Date(r.last_crawled).getTime() > STALE_DAYS * 86_400_000
        : false;
    return {
      all: rows.length,
      indexed: rows.filter((r) => r.index_state === "INDEXED").length,
      unknown: rows.filter((r) => r.index_state === "UNKNOWN").length,
      discovered: rows.filter((r) => r.index_state === "DISCOVERED").length,
      crawled_not_indexed: rows.filter((r) => r.index_state === "CRAWLED_NOT_INDEXED").length,
      excluded: rows.filter((r) => r.index_state === "EXCLUDED").length,
      errors: rows.filter((r) => r.index_state === "ERROR").length,
      phantom: rows.filter(
        (r) => r.page_check?.status_code === 404 && r.index_state !== "INDEXED",
      ).length,
      stale_index: rows.filter(
        (r) =>
          r.index_state === "INDEXED" &&
          r.page_check?.status_code != null &&
          r.page_check.status_code >= 400,
      ).length,
      stale: rows.filter(stale).length,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterChip
          label="Indexed"
          count={counts.indexed}
          active={filter === "indexed"}
          onClick={() => setFilter("indexed")}
        />
        <FilterChip
          label="Unknown"
          count={counts.unknown}
          active={filter === "unknown"}
          onClick={() => setFilter("unknown")}
          emphasis="fail"
        />
        <FilterChip
          label="Discovered"
          count={counts.discovered}
          active={filter === "discovered"}
          onClick={() => setFilter("discovered")}
        />
        <FilterChip
          label="Crawled, NI"
          count={counts.crawled_not_indexed}
          active={filter === "crawled_not_indexed"}
          onClick={() => setFilter("crawled_not_indexed")}
        />
        <FilterChip
          label="Excluded"
          count={counts.excluded}
          active={filter === "excluded"}
          onClick={() => setFilter("excluded")}
        />
        <FilterChip
          label="Errors"
          count={counts.errors}
          active={filter === "errors"}
          onClick={() => setFilter("errors")}
        />
        <FilterChip
          label="Phantom (404)"
          count={counts.phantom}
          active={filter === "phantom"}
          onClick={() => setFilter("phantom")}
        />
        <FilterChip
          label="Stale index"
          title="Indexed in Google, but page returns 404 or 5xx"
          count={counts.stale_index}
          active={filter === "stale_index"}
          onClick={() => setFilter("stale_index")}
          emphasis="fail"
        />
        <FilterChip
          label={`Stale (${STALE_DAYS}d+)`}
          count={counts.stale}
          active={filter === "stale"}
          onClick={() => setFilter("stale")}
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by URL…"
          className="ml-auto w-full max-w-xs rounded border border-rule bg-coal px-3 py-1.5 text-sm font-mono
                     placeholder:text-smoke focus:border-beam focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-rule bg-coal">
        <table className="min-w-full divide-y divide-rule font-mono text-sm">
          <thead className="bg-shade text-[10px] uppercase tracking-widest text-smoke">
            <tr>
              <Th>URL</Th>
              <Th>Status</Th>
              <Th>Page</Th>
              <Th>Coverage</Th>
              <Th>Last crawled</Th>
              <Th>Sitemap date</Th>
              <Th className="text-right pr-4">↗</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {filtered.map((r) => (
              <Row key={r.url} r={r} />
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-smoke">
                  No URLs match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  emphasis,
  title,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  emphasis?: "warn" | "fail";
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-mono transition-colors
        ${active
          ? "bg-bone text-ink"
          : emphasis === "fail"
          ? "border border-fail/40 text-fail hover:bg-fail/10"
          : emphasis === "warn"
          ? "border border-warn/40 text-warn hover:bg-warn/10"
          : "border border-rule text-ash hover:bg-shade"}`}
    >
      {label}
      <span className="ml-2 text-smoke">{count}</span>
    </button>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2 text-left font-medium ${className}`}>{children}</th>;
}

function PageChip({ r }: { r: UrlResult }) {
  const pc = r.page_check;
  if (!pc) {
    return <span className="text-smoke">—</span>;
  }
  if (pc.error) {
    return (
      <span className="inline-flex rounded border border-rule px-2 py-0.5 text-xs text-smoke" title={pc.error}>
        {pc.error}
      </span>
    );
  }
  const code = pc.status_code;
  if (code === null || code === undefined) {
    return <span className="text-smoke">—</span>;
  }
  let cls = "border-rule text-smoke";
  if (code >= 200 && code < 300) cls = "border-live/40 bg-live/10 text-live";
  else if (code >= 300 && code < 400) cls = "border-warn/40 bg-warn/10 text-warn";
  else if (code >= 400) cls = "border-fail/40 bg-fail/10 text-fail";

  const redirectHint =
    pc.redirect_count && pc.redirect_count > 0 && pc.final_url
      ? `${pc.redirect_count} hop(s) → ${pc.final_url}`
      : pc.final_url && pc.final_url !== r.url
        ? `→ ${pc.final_url}`
        : undefined;

  return (
    <span
      className={`inline-flex rounded border px-2 py-0.5 text-xs tabular-nums ${cls}`}
      title={redirectHint}
    >
      {code >= 300 && code < 400 ? "↪ " : ""}
      {code}
    </span>
  );
}

function Row({ r }: { r: UrlResult }) {
  const meta = STATE_STYLES[r.index_state];
  return (
    <tr className="animate-rise hover:bg-shade/60 transition-colors">
      <td className="px-4 py-2 max-w-[36ch] truncate text-bone" title={r.url}>
        {r.url}
      </td>
      <td className="px-4 py-2">
        <span className="inline-flex items-center gap-2 text-ash">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="px-4 py-2">
        <PageChip r={r} />
      </td>
      <td className="px-4 py-2 text-smoke truncate max-w-[28ch]" title={r.coverage_state ?? ""}>
        {r.coverage_state ?? "—"}
      </td>
      <td className="px-4 py-2 text-smoke tabular-nums">{fmtDate(r.last_crawled)}</td>
      <td className="px-4 py-2 text-smoke tabular-nums">{fmtDate(r.sitemap_lastmod)}</td>
      <td className="px-4 py-2 text-right pr-4">
        {r.inspection_url && (
          <a
            href={r.inspection_url}
            target="_blank"
            rel="noreferrer"
            className="text-beam hover:text-beam2"
            title="Open in Search Console"
          >
            ↗
          </a>
        )}
      </td>
    </tr>
  );
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}
