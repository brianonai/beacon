"use client";

import type { ScanSummary } from "@/lib/api";

type Props = {
  total: number;
  indexed: number;
  unknown: number;
  errors: number;
  discovered: number;
  crawledNotIndexed: number;
  summary?: ScanSummary | null;
};

export function StatCards({
  total,
  indexed,
  unknown,
  errors,
  discovered,
  crawledNotIndexed,
  summary,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card label="In sitemap" value={total} accent="bone" />
        <Card label="Indexed" value={indexed} accent="live" />
        <Card label="Unknown" value={unknown} accent="fail" variant="unknown" />
        <Card label="Discovered" value={discovered} accent="warn" />
        <Card label="Crawled NI" value={crawledNotIndexed} accent="warn" />
        <Card label="Errors" value={errors} accent="fail" />
      </div>
      {summary && (
        <p className="text-xs text-smoke font-mono">
          Stale ({">"} 180d since crawl): {summary.stale} · {Math.round(summary.duration_ms / 1000)}s
          scan
        </p>
      )}
    </div>
  );
}

type Accent = "bone" | "live" | "warn" | "fail";
const ACCENTS: Record<Accent, string> = {
  bone: "text-bone",
  live: "text-live",
  warn: "text-warn",
  fail: "text-fail",
};

function Card({
  label,
  value,
  accent,
  variant,
}: {
  label: string;
  value: number;
  accent: Accent;
  variant?: "unknown";
}) {
  const isUnknown = variant === "unknown";
  return (
    <div
      className={`rounded-lg border bg-coal px-4 py-3
        ${isUnknown
          ? "border-fail/60 shadow-[0_0_0_1px_rgba(248,113,113,0.35)]"
          : "border-rule"}`}
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-smoke">
        {label}
      </div>
      <div className={`mt-1 font-display text-2xl lg:text-3xl tabular-nums tracking-tightest ${ACCENTS[accent]}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
