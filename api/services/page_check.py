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

from ..settings import get_settings

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
    concurrency: int | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Yield {url, page_check, completed, total} for each URL as it finishes."""
    settings = get_settings()
    conc = concurrency if concurrency is not None else settings.page_check_concurrency
    sem = asyncio.Semaphore(conc)
    headers = {"User-Agent": settings.user_agent}
    total = len(urls)

    limits = httpx.Limits(max_keepalive_connections=20, max_connections=conc + 5)
    async with httpx.AsyncClient(
        headers=headers,
        follow_redirects=True,
        timeout=HTTP_TIMEOUT,
        limits=limits,
        max_redirects=settings.max_redirects,
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
