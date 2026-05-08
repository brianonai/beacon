"""
Beacon API — FastAPI app entrypoint.

Run locally:
    uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

In Docker:
    See ../docker-compose.yml
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router
from .routes.discover import router as discover_router
from .routes.preview import router as preview_router
from .routes.properties import router as properties_router
from .routes.scan import router as scan_router
from .settings import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Beacon",
        description="Sitemap vs Google Index delta viewer.",
        version="1.5.1",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.allowed_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(properties_router)
    app.include_router(discover_router)
    app.include_router(preview_router)
    app.include_router(scan_router)

    @app.get("/health")
    def health() -> dict:
        return {"ok": True}

    return app


app = create_app()
