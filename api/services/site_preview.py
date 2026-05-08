"""
Site preview metadata via microlink.io.

Returns title, description, screenshot URL, and logo for a given URL.
Encapsulated behind this service so it can be swapped for Playwright or
a self-hosted screenshot service later without touching the route.

We follow HTTP redirects locally first (HEAD, then GET if needed) so apex
domains that 301 to www (e.g. plotluck.app → www.plotluck.app) match what
works when you curl the final URL.

For bare origins (scheme + host + ``/`` only, default port), we probe **apex
first**, then ``https://www.{host}/`` if the first request never connects
(subdomains often have no ``www`` DNS; some apex-only sites are the reverse).

Matches Microlink’s documented usage: GET with `url` and `screenshot=true`.
If that returns an error, we retry with `url` only (metadata + OG image).

Optional `MICROLINK_API_KEY` sets `x-api-key` for higher limits / Pro features.
"""
from __future__ import annotations

import json
from typing import Any, Optional
from urllib.parse import urlencode, urlparse, urlunparse

import httpx
from pydantic import BaseModel, Field

from ..settings import get_settings

MICROLINK_BASE = "https://api.microlink.io/"
HTTP_TIMEOUT = 12.0
RESOLVE_TIMEOUT = 10.0

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}


class SitePreview(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    screenshot_url: Optional[str] = None
    logo_url: Optional[str] = None
    error: Optional[str] = None
    # What we received vs what we sent to Microlink after following redirects.
    requested_url: Optional[str] = None
    resolved_url: Optional[str] = None
    resolve_note: Optional[str] = None
    microlink_errors: list[str] = Field(default_factory=list)
    # Echo of query Microlink saw on the last attempt (for debugging).
    last_microlink_query: Optional[str] = None


def _request_headers() -> dict[str, str]:
    key = (get_settings().microlink_api_key or "").strip()
    h = {**HEADERS}
    if key:
        h["x-api-key"] = key
    return h


def _normalize_input_url(url: str) -> str:
    u = url.strip()
    if not u:
        return u
    if "://" not in u:
        u = f"https://{u}"
    return u


def _origin_probe_urls(requested_url: str) -> list[str]:
    """URLs to try for a site root: given host first, then www variant if applicable."""
    p = urlparse(requested_url)
    host = (p.hostname or "").rstrip(".")
    if not host:
        return [requested_url]
    scheme = p.scheme or "https"
    path = p.path or ""
    if path not in ("", "/") or p.query or p.fragment:
        return [requested_url]
    if p.port is not None:
        return [requested_url]
    if host.lower().startswith("www."):
        return [urlunparse((scheme, host, "/", "", "", ""))]
    return [
        urlunparse((scheme, host, "/", "", "", "")),
        urlunparse((scheme, f"www.{host}", "/", "", "", "")),
    ]


async def _resolve_final_url_candidates(urls: list[str]) -> tuple[str, Optional[str]]:
    """Try each URL until one connects; return (final_url_after_redirects, error_note_if_all_failed)."""
    last_note: Optional[str] = None
    last_resolved = urls[0] if urls else ""
    for u in urls:
        resolved, note = await _resolve_final_url(u)
        last_resolved = resolved
        if note is None:
            return resolved, None
        last_note = note
    return last_resolved, last_note


async def _resolve_final_url(url: str) -> tuple[str, Optional[str]]:
    """Follow redirects locally; return (final_url, note if probe failed)."""
    async with httpx.AsyncClient(
        timeout=RESOLVE_TIMEOUT,
        follow_redirects=True,
        headers=HEADERS,
    ) as client:
        try:
            r = await client.head(url)
            if r.status_code in (405, 501) or r.status_code >= 400:
                r = await client.get(url)
            return str(r.url), None
        except httpx.RequestError as e:
            return url, f"{type(e).__name__}: {e}"


def _microlink_query_echo(params: dict[str, str]) -> str:
    """Single-line debug: full Microlink URL Microlink received."""
    return f"{MICROLINK_BASE}?{urlencode(params)}"


def _extract_microlink_errors(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("errors")
    if isinstance(raw, dict):
        return [json.dumps(raw)]
    if not isinstance(raw, list):
        return []
    out: list[str] = []
    for e in raw[:20]:
        if isinstance(e, str):
            out.append(e)
        elif isinstance(e, dict):
            msg = e.get("message") or e.get("details") or e.get("name")
            if msg:
                out.append(str(msg))
            else:
                out.append(json.dumps(e))
        else:
            out.append(str(e))
    return out


def _data_from_payload(
    payload: dict[str, Any],
    *,
    requested_url: str,
    resolved_url: str,
    last_microlink_query: str,
) -> SitePreview:
    data = payload.get("data", {}) or {}
    screenshot = (data.get("screenshot") or {}).get("url")
    og_image = (data.get("image") or {}).get("url")
    return SitePreview(
        title=data.get("title"),
        description=data.get("description"),
        screenshot_url=screenshot or og_image,
        logo_url=(data.get("logo") or {}).get("url"),
        requested_url=requested_url,
        resolved_url=resolved_url,
        last_microlink_query=last_microlink_query,
    )


def _format_microlink_error(payload: dict[str, Any], http_status: int) -> str:
    msg = payload.get("message")
    parts: list[str] = [f"HTTP {http_status}"]
    if msg:
        parts.append(str(msg))
    errs = _extract_microlink_errors(payload)
    if errs:
        parts.append(" | ".join(errs[:5]))
    return ": ".join(parts)


def _microlink_tries(url: str) -> list[dict[str, str]]:
    """Same params as Microlink docs: url + screenshot, then metadata-only fallback."""
    return [
        {"url": url, "screenshot": "true"},
        {"url": url},
    ]


async def fetch_preview(url: str) -> SitePreview:
    """Best-effort site preview. Errors return a preview with `error` set."""
    requested_url = _normalize_input_url(url)
    if not requested_url:
        return SitePreview(error="Empty URL")

    resolved_url, resolve_note = await _resolve_final_url_candidates(
        _origin_probe_urls(requested_url)
    )
    microlink_target = resolved_url

    last_error: Optional[SitePreview] = None
    headers = _request_headers()

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers=headers) as client:
            for params in _microlink_tries(microlink_target):
                echo = _microlink_query_echo(params)
                r = await client.get(MICROLINK_BASE, params=params)

                try:
                    payload = r.json()
                except ValueError:
                    last_error = SitePreview(
                        error=f"HTTP {r.status_code}: response was not JSON",
                        requested_url=requested_url,
                        resolved_url=resolved_url,
                        resolve_note=resolve_note,
                        last_microlink_query=echo,
                    )
                    continue

                if not isinstance(payload, dict):
                    last_error = SitePreview(
                        error=f"HTTP {r.status_code}: unexpected JSON body",
                        requested_url=requested_url,
                        resolved_url=resolved_url,
                        resolve_note=resolve_note,
                        last_microlink_query=echo,
                    )
                    continue

                if r.status_code >= 400:
                    last_error = SitePreview(
                        error=_format_microlink_error(payload, r.status_code),
                        requested_url=requested_url,
                        resolved_url=resolved_url,
                        resolve_note=resolve_note,
                        microlink_errors=_extract_microlink_errors(payload),
                        last_microlink_query=echo,
                    )
                    continue

                if payload.get("status") != "success":
                    last_error = SitePreview(
                        error=str(payload.get("message") or "microlink_error"),
                        requested_url=requested_url,
                        resolved_url=resolved_url,
                        resolve_note=resolve_note,
                        microlink_errors=_extract_microlink_errors(payload),
                        last_microlink_query=echo,
                    )
                    continue

                prev = _data_from_payload(
                    payload,
                    requested_url=requested_url,
                    resolved_url=resolved_url,
                    last_microlink_query=echo,
                )
                if resolve_note:
                    prev.resolve_note = resolve_note
                return prev

    except httpx.RequestError as e:
        return SitePreview(
            error=type(e).__name__,
            requested_url=requested_url,
            resolved_url=resolved_url,
            resolve_note=resolve_note,
        )

    return (
        last_error
        or SitePreview(
            error="Preview unavailable",
            requested_url=requested_url,
            resolved_url=resolved_url,
            resolve_note=resolve_note,
        )
    )
