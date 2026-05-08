// EventSource only supports GET, and our /api/scan is a POST (it carries
// a JSON body). So we use fetch + ReadableStream and parse SSE manually.

import type { UrlResult, ScanSummary, PageCheck } from "./api";

export type ScanEvents = {
  onStarted?: (e: { total: number; started_at: string }) => void;
  onProgress?: (e: { result: UrlResult; completed: number; total: number }) => void;
  onPageCheckStarted?: (e: { total: number }) => void;
  onPageCheckProgress?: (e: {
    url: string;
    page_check: PageCheck;
    completed: number;
    total: number;
  }) => void;
  onPageCheckDone?: (e: { phantom_count: number }) => void;
  onDone?: (e: { summary: ScanSummary }) => void;
  onError?: (e: { message: string }) => void;
};

export async function streamScan(
  body: { property_url: string; sitemap_url: string },
  events: ScanEvents,
  signal?: AbortSignal,
): Promise<void> {
  const r = await fetch("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    credentials: "include",
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok || !r.body) {
    events.onError?.({ message: `${r.status} ${r.statusText}` });
    return;
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      dispatch(frame, events);
    }
  }
}

function dispatch(frame: string, events: ScanEvents) {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return;
  let payload: unknown;
  try { payload = JSON.parse(dataLines.join("\n")); }
  catch { return; }

  switch (event) {
    case "started":           events.onStarted?.(payload as never); break;
    case "progress":          events.onProgress?.(payload as never); break;
    case "page_check_started": events.onPageCheckStarted?.(payload as never); break;
    case "page_check_progress": events.onPageCheckProgress?.(payload as never); break;
    case "page_check_done":  events.onPageCheckDone?.(payload as never); break;
    case "done":             events.onDone?.(payload as never); break;
    case "error":            events.onError?.(payload as never); break;
  }
}
