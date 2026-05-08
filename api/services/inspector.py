"""
URL inspection orchestration.

Concurrency:
  - asyncio.Semaphore caps to settings.inspect_concurrency (default 10)
  - Per-call jitter via asyncio.sleep keeps us below the per-minute API limit
  - asyncio.as_completed lets us yield results as they finish

URL Inspection API limits (as of writing):
  - 2,000 calls/day per property
  - 600 calls/minute per property
"""
from __future__ import annotations

import asyncio
import random
from datetime import datetime, timezone
from typing import AsyncIterator, Optional

from google.oauth2.credentials import Credentials
from googleapiclient.errors import HttpError

from ..settings import get_settings
from .google import inspect_url, shape_inspection


async def inspect_one(
    sem: asyncio.Semaphore,
    creds: Credentials,
    site_url: str,
    url: str,
    sitemap_lastmod: Optional[datetime],
) -> dict:
    """Run one inspection, return a shaped UrlResult dict (or an error result)."""
    settings = get_settings()
    async with sem:
        # Jitter to spread requests; combined with the semaphore this keeps us
        # well under per-minute caps without forcing strict pacing.
        if settings.inspect_jitter_ms > 0:
            await asyncio.sleep(random.uniform(0, settings.inspect_jitter_ms / 1000))
        try:
            raw = await asyncio.to_thread(inspect_url, creds, site_url, url)
            shaped = shape_inspection(site_url, url, raw)
            shaped["sitemap_lastmod"] = (
                sitemap_lastmod.isoformat() if sitemap_lastmod else None
            )
            return shaped
        except HttpError as e:
            return {
                "url": url,
                "in_sitemap": True,
                "index_state": "ERROR",
                "coverage_state": None,
                "issues": [f"Inspection failed: HTTP {e.resp.status}"],
                "sitemap_lastmod": sitemap_lastmod.isoformat() if sitemap_lastmod else None,
            }
        except Exception as e:  # noqa: BLE001
            return {
                "url": url,
                "in_sitemap": True,
                "index_state": "ERROR",
                "coverage_state": None,
                "issues": [f"Inspection failed: {type(e).__name__}"],
                "sitemap_lastmod": sitemap_lastmod.isoformat() if sitemap_lastmod else None,
            }


async def inspect_stream(
    creds: Credentials,
    site_url: str,
    entries: list[tuple[str, Optional[datetime]]],
) -> AsyncIterator[dict]:
    """Yield per-URL results as they complete, then a final summary dict.

    Yielded shapes:
      {"kind": "started", "total": int, "started_at": iso}
      {"kind": "progress", "result": UrlResult, "completed": int, "total": int}
      {"kind": "done",     "summary": ScanSummary}
    """
    settings = get_settings()
    started = datetime.now(timezone.utc)
    total = len(entries)

    yield {"kind": "started", "total": total, "started_at": started.isoformat()}

    sem = asyncio.Semaphore(settings.inspect_concurrency)
    tasks = [
        asyncio.create_task(inspect_one(sem, creds, site_url, url, lastmod))
        for url, lastmod in entries
    ]

    summary = {
        "indexed": 0,
        "unknown": 0,
        "discovered": 0,
        "crawled_not_indexed": 0,
        "excluded": 0,
        "errors": 0,
        "stale": 0,
    }
    stale_cutoff = datetime.now(timezone.utc).timestamp() - (settings.stale_days * 86400)

    completed = 0
    for coro in asyncio.as_completed(tasks):
        result = await coro
        completed += 1

        state = result.get("index_state")
        if state == "INDEXED":
            summary["indexed"] += 1
        elif state == "UNKNOWN":
            summary["unknown"] += 1
        elif state == "DISCOVERED":
            summary["discovered"] += 1
        elif state == "CRAWLED_NOT_INDEXED":
            summary["crawled_not_indexed"] += 1
        elif state == "EXCLUDED":
            summary["excluded"] += 1
        elif state == "ERROR":
            summary["errors"] += 1

        last_crawled = result.get("last_crawled")
        if last_crawled:
            try:
                ts = datetime.fromisoformat(last_crawled.replace("Z", "+00:00")).timestamp()
                if ts < stale_cutoff:
                    summary["stale"] += 1
            except (ValueError, AttributeError):
                pass

        yield {
            "kind": "progress",
            "result": result,
            "completed": completed,
            "total": total,
        }

    duration_ms = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    yield {
        "kind": "done",
        "summary": {**summary, "total": total, "duration_ms": duration_ms},
    }
