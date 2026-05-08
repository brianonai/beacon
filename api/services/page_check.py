"""
HTTP page checks for URLs Google reports as not-indexed.

The goal: a three-way diff between
    (1) what the sitemap claims exists
    (2) what the page actually returns when fetched
    (3) what Google decided to do with it
"""
from __future__ import annotations

import asyncio
import time
from typing import Any, AsyncIterator

import httpx

USER_AGENT = "BeaconBot/0.1 (+https://github.com/brianonai/beacon)"
MAX_REDIRECTS = 5
HTTP_TIMEOUT = 10.0


async def check_one(
    sem: asyncio.Semaphore,
    client: httpx.AsyncClient,
    url: str,
) -> dict[str, Any]:
    """Return a page_check dict for one URL.

    Tries HEAD first (fast, polite). Falls back to GET on 405 since
    some servers reject HEAD. Captures status code, final URL after
    redirects, redirect hop count, response time, content-type.
    """
    async with sem:
        started = time.perf_counter()
        try:
            r = await client.head(url, follow_redirects=True, timeout=HTTP_TIMEOUT)
            if r.status_code == 405:
                r = await client.get(url, follow_redirects=True, timeout=HTTP_TIMEOUT)
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            return {
                "status_code": r.status_code,
                "final_url": str(r.url),
                "redirect_count": len(r.history),
                "response_time_ms": elapsed_ms,
                "content_type": r.headers.get("content-type"),
                "error": None,
            }
        except httpx.HTTPError as e:
            return {
                "status_code": None,
                "final_url": None,
                "redirect_count": 0,
                "response_time_ms": None,
                "content_type": None,
                "error": type(e).__name__,
            }


async def check_stream(
    urls: list[str],
    concurrency: int = 5,
) -> AsyncIterator[dict[str, Any]]:
    """Yield {url, page_check, completed, total} for each URL as it finishes."""
    sem = asyncio.Semaphore(concurrency)
    headers = {"User-Agent": USER_AGENT}
    total = len(urls)

    limits = httpx.Limits(max_keepalive_connections=20, max_connections=concurrency + 5)
    async with httpx.AsyncClient(
        headers=headers,
        follow_redirects=True,
        timeout=HTTP_TIMEOUT,
        limits=limits,
        max_redirects=MAX_REDIRECTS,
      ) as client:
        tasks = [asyncio.create_task(_wrap(sem, client, u)) for u in urls]
        completed = 0
        for coro in asyncio.as_completed(tasks):
            url, check = await coro
            completed += 1
            yield {
                "url": url,
                "page_check": check,
                "completed": completed,
                "total": total,
            }


async def _wrap(
    sem: asyncio.Semaphore,
    client: httpx.AsyncClient,
    url: str,
) -> tuple[str, dict[str, Any]]:
    return url, await check_one(sem, client, url)
