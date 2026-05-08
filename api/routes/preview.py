"""GET /api/preview?url=... — site preview metadata for the scan header."""
from __future__ import annotations

from fastapi import APIRouter, Query, Request

from ..auth import credentials_from_request
from ..services.site_preview import SitePreview, fetch_preview

router = APIRouter(prefix="/api", tags=["preview"])


@router.get("/preview", response_model=SitePreview)
async def get_preview(
    request: Request,
    url: str = Query(..., description="URL to fetch preview for"),
) -> SitePreview:
    credentials_from_request(request)
    return await fetch_preview(url)
