"""Data shapes for Beacon. No DB — these are wire formats only."""
from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


# ---- Properties -----------------------------------------------------------

PropertyType = Literal["DOMAIN", "URL_PREFIX"]


class Property(BaseModel):
    """A Search Console property the user has access to."""
    site_url: str = Field(..., description="e.g. 'sc-domain:example.com' or 'https://example.com/'")
    type: PropertyType
    permission_level: str = Field(..., description="e.g. 'siteOwner', 'siteFullUser'")


# ---- Discovery ------------------------------------------------------------

SitemapSource = Literal["robots", "default", "index", "user"]


class DiscoveredSitemap(BaseModel):
    url: str
    source: SitemapSource
    url_count: int


class DiscoverRequest(BaseModel):
    property_url: str
    paste_sitemap_url: Optional[str] = None


class DiscoverResponse(BaseModel):
    sitemaps: list[DiscoveredSitemap]
    total_urls: int
    sample_urls: list[str]


# ---- Scan ----------------------------------------------------------------

IndexState = Literal[
    "INDEXED",
    "UNKNOWN",
    "DISCOVERED",
    "CRAWLED_NOT_INDEXED",
    "EXCLUDED",
    "ERROR",
    "PENDING",
]


class ScanRequest(BaseModel):
    property_url: str
    sitemap_url: str


class PageCheck(BaseModel):
    status_code: Optional[int] = None
    final_url: Optional[str] = None
    redirect_count: int = 0
    response_time_ms: Optional[int] = None
    content_type: Optional[str] = None
    error: Optional[str] = None


class UrlResult(BaseModel):
    url: str
    in_sitemap: bool = True
    sitemap_lastmod: Optional[datetime] = None
    index_state: IndexState
    coverage_state: Optional[str] = None
    last_crawled: Optional[datetime] = None
    last_indexed: Optional[datetime] = None
    page_fetch_state: Optional[str] = None
    robots_txt_state: Optional[str] = None
    issues: list[str] = Field(default_factory=list)
    inspection_url: Optional[str] = None  # GSC deeplink
    page_check: Optional[PageCheck] = None


class ScanSummary(BaseModel):
    total: int
    indexed: int
    unknown: int
    discovered: int
    crawled_not_indexed: int
    excluded: int
    errors: int
    stale: int  # last_crawled > 180 days ago
    duration_ms: int
    phantom_count: int = 0
