"""GET /api/properties — list the user's verified Search Console properties."""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Request

from ..auth import credentials_from_request
from ..services.google import list_properties

router = APIRouter(prefix="/api", tags=["properties"])


@router.get("/properties")
async def get_properties(request: Request) -> dict:
    creds = credentials_from_request(request)
    sites = await asyncio.to_thread(list_properties, creds)
    # Surface domain-property vs URL-prefix at the top so the UI can call it out.
    return {"properties": sites}
