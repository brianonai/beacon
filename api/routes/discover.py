"""POST /api/discover — find sitemaps for a property and return URL inventory."""
from __future__ import annotations

from fastapi import APIRouter, Request

from ..models import DiscoverRequest, DiscoverResponse
from ..services.sitemap import discover

router = APIRouter(prefix="/api", tags=["discover"])


@router.post("/discover", response_model=DiscoverResponse)
async def post_discover(req: DiscoverRequest, request: Request) -> DiscoverResponse:
    # Auth not strictly required for sitemap fetch (it's public),
    # but we want the same 401 surface the rest of the API uses.
    from ..auth import credentials_from_request  # local to avoid circular import
    credentials_from_request(request)  # raises 401 if missing

    result = await discover(req.property_url, req.paste_sitemap_url)
    return DiscoverResponse(
        sitemaps=result["sitemaps"],
        total_urls=result["total_urls"],
        sample_urls=result["sample_urls"],
    )
