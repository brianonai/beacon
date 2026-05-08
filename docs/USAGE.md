# Beacon — Usage guide

This guide walks you from “I have a domain in Search Console” to “I exported a CSV and know what the colors mean.” It assumes Beacon is already installed (see **INSTALLATION.md**).

---

## 1. Starting point: I have a domain

You need:

1. A **verified property** in Google Search Console (domain or URL-prefix) for the site you care about.
2. A **sitemap** — usually referenced from `robots.txt` or living at a well-known path (`/sitemap.xml`, `/sitemap_index.xml`, etc.).

Open Beacon at `http://localhost:13000`, sign in with **Connect Search Console**, and pick the property that **matches** how Google sees your site (www vs non-www matters).

---

## 2. Picking sitemaps

Beacon tries:

- `robots.txt` on your host for `Sitemap:` lines
- Common fallback URLs

If discovery returns **nothing**, use **Use a different sitemap URL** on the home page and paste the exact XML URL.

**Multiple sitemaps:** If several are discovered, choose one for this scan (index sitemap vs section sitemap). A banner may warn about redundant sitemaps and crawl budget — trimming duplicate `Sitemap:` entries in `robots.txt` is good hygiene.

---

## 3. During the scan

Two phases appear (unless you **loaded from cache**):

1. **Inspecting URLs (GSC)** — URL Inspection API calls (quota applies).
2. **Checking pages (HTTP)** — HEAD/GET to your URLs for status codes, redirects, and timing.

You can leave the tab open. If you close mid-scan, you do **not** get a partial cache — only a completed scan is cached locally.

---

## 4. Understanding each status

Beacon collapses Google’s states into a small set you can filter on:

### Indexed

Google reports the URL is indexed. Healthy baseline. Still look at HTTP status — rare mismatches happen if the page changed since Google’s last crawl.

### Unknown

Google has **not** reported a concrete indexing verdict yet. Common for **very new URLs**, sitemaps Google has not fully processed, or URLs not discovered through normal signals.

**What to do:** Wait and re-scan; confirm the property matches the sitemap host; submit the sitemap manually in GSC once.

### Discovered, not indexed / similar “discovered” states

Google knows the URL exists but hasn’t committed to indexing. Often a **quality / authority / duplication** signal rather than a technical block.

**What to do:** Strengthen uniqueness, internal links, and site-level trust signals; avoid thin or duplicate templates.

### Crawled, not indexed

Google **fetched** the page and chose not to index it. This is often the **most actionable** “quality” bucket: content or site architecture may not clear the bar.

**What to do:** Compare against stronger competitors on the same intent; fix duplication; improve depth and internal linking.

### Excluded

Deliberately not indexed — `noindex`, robots block, canonical to another URL, etc.

**What to do:** Confirm exclusions are **intentional**. Accidental `noindex` or wrong canonical is common.

### Errors

Index or fetch errors on Google’s side for that URL.

**What to do:** Read the specific reason in Search Console using the **inspection link** from the row when present.

### Phantom (404) — in-app emphasis

URLs that are **in your sitemap** but return **404** (and are **not** indexed) are highlighted as problematic: the sitemap promises a page that doesn’t exist.

**What to do:** Remove or fix immediately — they waste crawl budget and confuse signals.

---

## 5. Patterns (quick reference)

| You see… | Often means… |
|----------|----------------|
| Mostly Unknown | Fresh site / unfetched sitemap |
| Many crawled-not-indexed | Quality or template duplication |
| Many phantoms | Sitemap hygiene emergency |
| Misleading totals | **Wrong GSC property** vs sitemap host |

The README contains a compact pattern table; this section expands the **why** behind each.

---

## 6. Worked example: Chilistation

Brian’s write-up **[I spent five months building a content-rich recipe site; Google had indexed 7% of it](https://brianonai.com/blog/i-spent-five-months-building-a-content-rich-recipe-site-google-had-indexed-7-percent-of-it)** is a real-world case of sitemap scale, internal linking, and indexing friction.

Reading it alongside a Beacon export makes the abstract statuses concrete: you’ll recognize “crawled-not-indexed at scale” vs a simple “we haven’t been crawled yet” Unknown wall.

---

## 7. Export CSV

Click **Export CSV** after the scan completes. The file includes URL, index state, HTTP status and final URL, coverage hints, timestamps, and joined issues.

**Use cases:**

- Share with clients without giving GSC access.
- Pivot in Sheets/Excel.
- Diff two exports later (manual V1 workflow).

---

## 8. Cache and Re-scan

When you reload a finished scan URL (`/scan?property=…&sitemap=…`), Beacon may **restore the last successful result** from `localStorage` and show **Loaded from cache · N ago**.

Click **Re-scan** to clear that entry and stream a fresh scan (subject to Google quota).

---

## 9. What Beacon is not doing

- Not **requesting indexing** via Google’s Indexing API.
- Not storing your scan history server-side (V1).
- Not sending your URLs to a third-party SaaS analytics product.

That keeps the compliance story simple: **your machine, your Google project, your data.**

---

## 10. Next steps

- Operational issues → **TROUBLESHOOTING.md**
- Data handling → **PRIVACY.md**
- Install paths → **INSTALLATION.md**

You’re ready to run repeated scans, interpret the table honestly, and export evidence for stakeholders.
