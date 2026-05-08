"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ScanSummary, UrlResult, PageCheck, SitePreview } from "@/lib/api";
import { api } from "@/lib/api";
import { streamScan } from "@/lib/sse";
import { clearScan, formatRelative, loadCached, saveScan } from "@/lib/scanCache";
import { StatCards } from "@/components/StatCards";
import { ScanProgress } from "@/components/ScanProgress";
import { ResultsTable } from "@/components/ResultsTable";
import { SitePreviewCard } from "@/components/SitePreviewCard";

export function ScanClient() {
  const router = useRouter();
  const params = useSearchParams();
  const property = params.get("property");
  const sitemap = params.get("sitemap");

  const [rows, setRows] = useState<UrlResult[]>([]);
  const [inspectCompleted, setInspectCompleted] = useState(0);
  const [inspectTotal, setInspectTotal] = useState(0);
  const [pageCheckCompleted, setPageCheckCompleted] = useState(0);
  const [pageCheckTotal, setPageCheckTotal] = useState(0);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sitePreview, setSitePreview] = useState<SitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const sitePreviewRef = useRef<SitePreview | null>(null);

  useEffect(() => {
    sitePreviewRef.current = sitePreview;
  }, [sitePreview]);

  const inspectionDone = inspectTotal > 0 && inspectCompleted >= inspectTotal;
  const scanDone = !!summary;

  useEffect(() => {
    if (!property || !sitemap) return;

    const cached = loadCached(property, sitemap);
    if (cached) {
      setRows(cached.rows);
      setSummary(cached.summary);
      setSitePreview(cached.preview);
      setInspectTotal(cached.summary.total);
      setInspectCompleted(cached.summary.total);
      setPageCheckTotal(0);
      setPageCheckCompleted(0);
      setScannedAt(cached.scannedAt);
      setFromCache(true);
      setError(null);
      return;
    }

    setRows([]);
    setSummary(null);
    setSitePreview(null);
    setInspectTotal(0);
    setInspectCompleted(0);
    setPageCheckTotal(0);
    setPageCheckCompleted(0);
    setScannedAt(null);
    setFromCache(false);
    setError(null);

    const ac = new AbortController();
    streamScan(
      { property_url: property, sitemap_url: sitemap },
      {
        onStarted: ({ total }) => {
          setInspectTotal(total);
          setInspectCompleted(0);
        },
        onProgress: ({ result, completed }) => {
          setRows((prev) => [...prev, result]);
          setInspectCompleted(completed);
        },
        onPageCheckStarted: ({ total: n }) => {
          setPageCheckTotal(n);
          setPageCheckCompleted(0);
        },
        onPageCheckProgress: ({ url, page_check, completed }) => {
          setPageCheckCompleted(completed);
          setRows((prev) =>
            prev.map((r) => (r.url === url ? { ...r, page_check: page_check as PageCheck } : r)),
          );
        },
        onPageCheckDone: () => {},
        onDone: ({ summary: s }) => {
          const at = new Date().toISOString();
          setSummary(s);
          setRows((latestRows) => {
            saveScan(
              property,
              sitemap,
              {
                rows: latestRows,
                summary: s,
                preview: sitePreviewRef.current,
              },
              at,
            );
            return latestRows;
          });
          setScannedAt(at);
          setFromCache(false);
        },
        onError: ({ message }) => setError(message),
      },
      ac.signal,
    );
    return () => ac.abort();
  }, [property, sitemap]);

  /** Refresh cache when Microlink preview arrives after scan completes. */
  useEffect(() => {
    if (fromCache || !property || !sitemap || !summary || !scannedAt) return;
    saveScan(property, sitemap, { rows, summary, preview: sitePreview }, scannedAt);
  }, [fromCache, property, sitemap, summary, rows, sitePreview, scannedAt]);

  useEffect(() => {
    if (!property) {
      setSitePreview(null);
      setPreviewLoading(false);
      return;
    }
    if (!sitemap) {
      setSitePreview(null);
      setPreviewLoading(false);
      return;
    }
    const cachedScan = loadCached(property, sitemap);
    if (cachedScan) {
      setSitePreview(cachedScan.preview);
      setPreviewLoading(false);
      return;
    }
    let previewUrl = property;
    if (property.startsWith("sc-domain:")) {
      const host = property.slice("sc-domain:".length).trim().replace(/^\/+/, "");
      previewUrl = host ? `https://www.${host}/` : property;
    }
    setPreviewLoading(true);
    let cancelled = false;
    api
      .preview(previewUrl)
      .then((p) => {
        if (!cancelled) setSitePreview(p);
      })
      .catch(() => {
        if (!cancelled) setSitePreview({ error: "Request failed" });
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [property, sitemap]);

  function handleRescan() {
    if (!property || !sitemap) return;
    clearScan(property, sitemap);
    location.reload();
  }

  const counts = useMemo(
    () => ({
      indexed: rows.filter((r) => r.index_state === "INDEXED").length,
      unknown: rows.filter((r) => r.index_state === "UNKNOWN").length,
      discovered: rows.filter((r) => r.index_state === "DISCOVERED").length,
      crawledNotIndexed: rows.filter((r) => r.index_state === "CRAWLED_NOT_INDEXED").length,
      errors: rows.filter((r) => r.index_state === "ERROR").length,
    }),
    [rows],
  );

  function exportCsv() {
    const header = [
      "url",
      "index_state",
      "page_status",
      "page_final_url",
      "coverage_state",
      "last_crawled",
      "sitemap_lastmod",
      "issues",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csv(r.url),
          r.index_state,
          r.page_check?.status_code != null ? String(r.page_check.status_code) : "",
          csv(r.page_check?.final_url ?? ""),
          csv(r.coverage_state ?? ""),
          r.last_crawled ?? "",
          r.sitemap_lastmod ?? "",
          csv(r.issues.join("; ")),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `beacon-scan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!property || !sitemap) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-ash">Missing scan parameters.</p>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen pb-20">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <button
          onClick={() => router.push("/")}
          className="font-mono text-xs uppercase tracking-[0.2em] text-ash hover:text-bone"
        >
          ← Beacon
        </button>
        <button
          onClick={exportCsv}
          disabled={!summary}
          className="rounded border border-rule px-3 py-1.5 text-xs font-mono text-ash
                     hover:bg-shade hover:text-bone disabled:opacity-50"
        >
          Export CSV
        </button>
      </header>

      <section className="mx-auto max-w-6xl px-6 space-y-6">
        <div>
          <h1 className="font-mono text-bone truncate">{propertyDisplayDomain(property)}</h1>
        </div>

        {previewLoading && (
          <div
            className="flex gap-4 overflow-hidden rounded-lg border border-rule bg-coal"
            aria-hidden
          >
            <div className="aspect-[16/10] w-52 shrink-0 animate-pulse bg-shade sm:w-60" />
            <div className="flex flex-1 flex-col justify-center gap-3 py-4 pr-8">
              <div className="h-3 w-40 animate-pulse rounded bg-rule" />
              <div className="h-8 max-w-md animate-pulse rounded bg-rule" />
              <div className="h-10 max-w-xl animate-pulse rounded bg-rule" />
            </div>
          </div>
        )}

        {!previewLoading && sitePreview && (
          <SitePreviewCard preview={sitePreview} domain={propertyDisplayDomain(property)} />
        )}

        {scannedAt && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule
                       bg-coal/60 px-4 py-2"
          >
            <p className="font-mono text-xs text-smoke">
              {fromCache ? "Loaded from cache" : "Scan complete"}
              {" · "}
              <span className="text-ash">{formatRelative(scannedAt)}</span>
            </p>
            <button
              type="button"
              onClick={handleRescan}
              className="rounded border border-rule px-3 py-1 text-xs font-mono text-ash
                         transition-colors hover:bg-shade hover:text-bone"
            >
              Re-scan
            </button>
          </div>
        )}

        {!fromCache && (
          <ScanProgress
            completed={inspectCompleted}
            total={inspectTotal}
            done={inspectionDone}
            title="Inspecting URLs (GSC)"
          />
        )}

        {!fromCache && pageCheckTotal > 0 && (
          <ScanProgress
            completed={pageCheckCompleted}
            total={pageCheckTotal}
            done={scanDone}
            title="Checking pages (HTTP)"
          />
        )}

        <StatCards
          total={inspectTotal}
          indexed={counts.indexed}
          unknown={counts.unknown}
          errors={counts.errors}
          discovered={counts.discovered}
          crawledNotIndexed={counts.crawledNotIndexed}
          summary={summary}
        />

        {error && (
          <div className="rounded-lg border border-fail/40 bg-fail/5 px-4 py-3 text-sm text-fail">
            Scan error: {error}
          </div>
        )}

        <ResultsTable rows={rows} />
      </section>
    </main>
  );
}

function csv(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function propertyDisplayDomain(property: string): string {
  if (property.startsWith("sc-domain:")) {
    return property.slice("sc-domain:".length);
  }
  try {
    return new URL(property).hostname;
  } catch {
    return property;
  }
}

