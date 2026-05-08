"""
Search Console API client.

Two services are needed:
  - webmasters v3       -> sites().list()
  - searchconsole v1    -> urlInspection().index().inspect()

google-api-python-client is sync; calls are wrapped in asyncio.to_thread
where the caller needs them in an async context.
"""
from __future__ import annotations

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


def webmasters_service(creds: Credentials):
    return build("webmasters", "v3", credentials=creds, cache_discovery=False)


def searchconsole_service(creds: Credentials):
    return build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def list_properties(creds: Credentials) -> list[dict]:
    """Return raw GSC sites with a normalized 'type' field."""
    service = webmasters_service(creds)
    resp = service.sites().list().execute()
    sites = resp.get("siteEntry", [])
    out = []
    for s in sites:
        site_url = s.get("siteUrl", "")
        out.append(
            {
                "site_url": site_url,
                "type": "DOMAIN" if site_url.startswith("sc-domain:") else "URL_PREFIX",
                "permission_level": s.get("permissionLevel", "siteUnverifiedUser"),
            }
        )
    return out


def inspect_url(creds: Credentials, site_url: str, inspection_url: str) -> dict:
    """One synchronous URL Inspection API call. Caller wraps in to_thread."""
    service = searchconsole_service(creds)
    body = {
        "inspectionUrl": inspection_url,
        "siteUrl": site_url,
    }
    resp = service.urlInspection().index().inspect(body=body).execute()
    return resp


# ---- Result shaping ------------------------------------------------------


def _norm_coverage(coverage: str) -> str:
    """Lowercase and normalize dashes so GSC strings match reliably."""
    s = (coverage or "").lower()
    for ch in ("\u2013", "\u2014"):  # en dash, em dash
        s = s.replace(ch, "-")
    return s


def _coverage_to_state(verdict: str, coverage: str) -> str:
    """Map GSC verdict + coverageState into IndexState (Fix 3 taxonomy)."""
    v = (verdict or "").upper()
    c = _norm_coverage(coverage or "")

    if v == "PASS":
        return "INDEXED"

    if "submitted and indexed" in c or "indexed, not submitted" in c or "indexed not submitted" in c:
        return "INDEXED"

    if not c.strip():
        return "PENDING"

    if "unknown to google" in c:
        return "UNKNOWN"

    if "discovered" in c and "not indexed" in c:
        return "DISCOVERED"
    if "crawled" in c and "not indexed" in c:
        return "CRAWLED_NOT_INDEXED"

    excluded_markers = (
        "noindex",
        "excluded",
        "blocked by robots",
        "page with redirect",
        "duplicate",
    )
    if any(m in c for m in excluded_markers):
        return "EXCLUDED"

    if v == "FAIL":
        return "ERROR"

    return "PENDING"


def shape_inspection(site_url: str, inspected_url: str, raw: dict) -> dict:
    """Convert the GSC inspection response into our UrlResult shape."""
    inspection = (raw or {}).get("inspectionResult", {}) or {}
    index_status = inspection.get("indexStatusResult", {}) or {}
    mobile = inspection.get("mobileUsabilityResult", {}) or {}
    rich = inspection.get("richResultsResult", {}) or {}

    verdict = index_status.get("verdict")
    coverage = index_status.get("coverageState")
    state = _coverage_to_state(verdict, coverage)

    issues: list[str] = []
    if (mobile.get("verdict") or "").upper() == "FAIL":
        issues.append("Mobile usability issue")
    if (rich.get("verdict") or "").upper() == "FAIL":
        issues.append("Rich results issue")
    if coverage and "not indexed" in coverage.lower():
        issues.append(coverage)

    return {
        "url": inspected_url,
        "in_sitemap": True,
        "index_state": state,
        "coverage_state": coverage,
        "last_crawled": index_status.get("lastCrawlTime"),
        "last_indexed": index_status.get("googleCanonical"),  # not perfect; nearest field
        "page_fetch_state": index_status.get("pageFetchState"),
        "robots_txt_state": index_status.get("robotsTxtState"),
        "issues": issues,
        "inspection_url": inspection.get("inspectionResultLink"),
    }
