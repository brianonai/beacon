"""
Sitemap discovery and parsing.

Discovery order:
  1. {property}/robots.txt — parse Sitemap: directives
  2. {property}/sitemap.xml
  3. {property}/sitemap_index.xml

Sitemap-index files (those with <sitemapindex> root) are recursed one level.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import httpx
from lxml import etree

USER_AGENT = "BeaconBot/0.1 (+https://github.com/yourname/beacon)"
HTTP_TIMEOUT = 15.0
MAX_INDEX_DEPTH = 2


def _root_url(property_url: str) -> str:
    """Normalize a GSC property to a fetchable HTTP root.

    Handles 'sc-domain:example.com' (DOMAIN type) and 'https://example.com/'
    (URL_PREFIX type).
    """
    if property_url.startswith("sc-domain:"):
        host = property_url.split(":", 1)[1].strip("/")
        return f"https://{host}/"
    return property_url if property_url.endswith("/") else property_url + "/"


async def _fetch(client: httpx.AsyncClient, url: str) -> Optional[bytes]:
    try:
        r = await client.get(url, timeout=HTTP_TIMEOUT, follow_redirects=True)
        if r.status_code == 200 and r.content:
            return r.content
    except httpx.HTTPError:
        pass
    return None


async def _sitemaps_from_robots(client: httpx.AsyncClient, root: str) -> list[str]:
    body = await _fetch(client, urljoin(root, "robots.txt"))
    if not body:
        return []
    found: list[str] = []
    for line in body.decode("utf-8", errors="replace").splitlines():
        m = re.match(r"^\s*sitemap\s*:\s*(\S+)\s*$", line, flags=re.IGNORECASE)
        if m:
            found.append(m.group(1))
    return found


def _parse_sitemap_xml(content: bytes) -> tuple[str, list[tuple[str, Optional[datetime]]]]:
    """
    Return (kind, entries) where:
      kind   = 'urlset' or 'sitemapindex'
      entries = [(loc, lastmod_or_None), ...]
    """
    parser = etree.XMLParser(recover=True, no_network=True, huge_tree=True)
    root = etree.fromstring(content, parser=parser)
    if root is None:
        return ("urlset", [])

    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    tag = etree.QName(root.tag).localname

    if tag == "sitemapindex":
        out: list[tuple[str, Optional[datetime]]] = []
        for sm in root.findall("sm:sitemap", ns):
            loc = (sm.findtext("sm:loc", namespaces=ns) or "").strip()
            if loc:
                out.append((loc, None))
        return ("sitemapindex", out)

    # urlset (or unknown — treat as urlset)
    entries: list[tuple[str, Optional[datetime]]] = []
    for u in root.findall("sm:url", ns):
        loc = (u.findtext("sm:loc", namespaces=ns) or "").strip()
        lastmod_raw = (u.findtext("sm:lastmod", namespaces=ns) or "").strip()
        lastmod = _parse_date(lastmod_raw)
        if loc:
            entries.append((loc, lastmod))
    return ("urlset", entries)


def _parse_date(raw: str) -> Optional[datetime]:
    if not raw:
        return None
    raw = raw.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        try:
            return datetime.strptime(raw[:10], "%Y-%m-%d")
        except ValueError:
            return None


async def _expand(
    client: httpx.AsyncClient, sitemap_url: str, depth: int = 0
) -> list[tuple[str, Optional[datetime]]]:
    """Recursively expand a sitemap (or sitemap index) into URL entries."""
    if depth > MAX_INDEX_DEPTH:
        return []
    content = await _fetch(client, sitemap_url)
    if not content:
        return []
    kind, entries = _parse_sitemap_xml(content)
    if kind == "urlset":
        return entries
    # sitemap index — fan out
    out: list[tuple[str, Optional[datetime]]] = []
    for child_url, _ in entries:
        out.extend(await _expand(client, child_url, depth + 1))
    return out


async def discover(property_url: str, paste: Optional[str] = None) -> dict:
    """Find sitemaps for a property and return URL inventory.

    Returns a dict matching DiscoverResponse plus an internal `entries` list
    used by the scan endpoint.
    """
    root = _root_url(property_url)
    headers = {"User-Agent": USER_AGENT}

    async with httpx.AsyncClient(headers=headers) as client:
        candidates: list[tuple[str, str]] = []  # (url, source)

        if paste:
            candidates.append((paste, "user"))
        else:
            for sm in await _sitemaps_from_robots(client, root):
                candidates.append((sm, "robots"))
            if not candidates:
                candidates.append((urljoin(root, "sitemap.xml"), "default"))
                candidates.append((urljoin(root, "sitemap_index.xml"), "default"))

        sitemaps = []
        all_entries: list[tuple[str, Optional[datetime]]] = []
        seen_locs: set[str] = set()

        for url, source in candidates:
            entries = await _expand(client, url)
            if not entries:
                continue
            sitemaps.append({"url": url, "source": source, "url_count": len(entries)})
            for loc, lastmod in entries:
                if loc not in seen_locs:
                    seen_locs.add(loc)
                    all_entries.append((loc, lastmod))

    sample = [u for u, _ in all_entries[:10]]
    return {
        "sitemaps": sitemaps,
        "total_urls": len(all_entries),
        "sample_urls": sample,
        "entries": all_entries,  # used by scan; not exposed in DiscoverResponse
    }
