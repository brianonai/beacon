"""
POST /api/scan — Server-Sent Events stream of URL inspection results.

We re-discover the sitemap server-side rather than trust client-supplied URL
lists. Keeps the request body small and avoids inspection requests for URLs
the user didn't actually have authority over.

After GSC inspection, all sitemap URLs get an HTTP page check; `done` fires
only after that phase completes.
"""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..auth import credentials_from_request
from ..models import ScanRequest
from ..services.inspector import inspect_stream
from ..services.page_check import check_stream as page_check_stream
from ..services.sitemap import discover

router = APIRouter(prefix="/api", tags=["scan"])


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.post("/scan")
async def post_scan(req: ScanRequest, request: Request) -> StreamingResponse:
    creds = credentials_from_request(request)

    # Re-fetch the sitemap server-side so we know exactly which URLs we're
    # about to inspect, with their lastmod values.
    discovered = await discover(req.property_url, req.sitemap_url)
    entries: list = discovered["entries"]
    if not entries:
        raise HTTPException(status_code=400, detail="No URLs found in sitemap")

    async def event_stream() -> AsyncIterator[str]:
        collected: list[dict[str, Any]] = []
        summary_base: dict[str, Any] | None = None

        async for evt in inspect_stream(creds, req.property_url, entries):
            kind = evt["kind"]
            if kind == "started":
                yield _sse("started", {k: v for k, v in evt.items() if k != "kind"})
            elif kind == "progress":
                collected.append(evt["result"])
                yield _sse(
                    "progress",
                    {
                        "result": evt["result"],
                        "completed": evt["completed"],
                        "total": evt["total"],
                    },
                )
            elif kind == "done":
                summary_base = evt["summary"]
                break

        if summary_base is None:
            return

        urls = [r["url"] for r in collected]
        phantom_count = 0

        if urls:
            yield _sse("page_check_started", {"total": len(urls)})
            async for pc_evt in page_check_stream(urls):
                url = pc_evt["url"]
                check = pc_evt["page_check"]
                for r in collected:
                    if r["url"] == url:
                        r["page_check"] = check
                        if (
                            check.get("status_code") == 404
                            and r.get("index_state") != "INDEXED"
                        ):
                            phantom_count += 1
                        break
                yield _sse("page_check_progress", pc_evt)
            yield _sse("page_check_done", {"phantom_count": phantom_count})
        else:
            yield _sse("page_check_done", {"phantom_count": 0})

        final_summary = {**summary_base, "phantom_count": phantom_count}
        yield _sse("done", {"summary": final_summary})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",  # nginx: don't buffer SSE
            "Connection": "keep-alive",
        },
    )
