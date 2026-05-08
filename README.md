<p align="center">
  <img src="docs/assets/beacon-logo.png" alt="Beacon" width="120">
</p>

<h1 align="center">Beacon</h1>

<p align="center">
  <strong>See what Google sees.</strong><br>
  Self-hosted indexing diagnostics for your sitemap, in one <code>docker compose up</code>.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#what-it-does">What It Does</a> ·
  <a href="#prerequisites">Prerequisites</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="https://beacon.brianonai.com">beacon.brianonai.com</a>
</p>

<p align="center">
  <a href="https://brianonai.com"><img src="https://img.shields.io/badge/built%20by-BrianOnAI-FFB020" alt="Built by BrianOnAI"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"></a>
  <a href="https://github.com/brianonai/beacon"><img src="https://img.shields.io/github/stars/brianonai/beacon?style=social" alt="GitHub stars"></a>
</p>

<p align="center">
  <em>Built by <a href="https://brianonai.com">Brian Diamond</a> — fractional CAIO, builder of <a href="https://onaro.io">Onaro</a> and <a href="https://thecaiobrief.substack.com">The CAIO Brief</a>.</em>
</p>

---

## What It Does

Beacon answers a question Google Search Console makes harder than it should be:

> **"Of the URLs in my sitemap, which ones is Google actually indexing — and which ones isn't it?"**

Point Beacon at your domain. It will:

1. Auto-discover your sitemap from `robots.txt` (or accept a paste)
2. Authenticate against your own Google Search Console via OAuth
3. Inspect each URL through the official URL Inspection API
4. Optionally fetch each URL with HTTP to detect dead pages, redirects, and stale content
5. Show you a clean breakdown: **Indexed, Unknown, Discovered, Crawled-Not-Indexed, Excluded, Errors**

No data ever leaves your machine. No SaaS account. No subscription. Your Google credentials, your data, your hardware.

Completed scans for the same property + sitemap pair can **reload instantly** from your browser’s local cache (optional **Re-scan** clears it and runs a fresh SSE stream).

### You can't rank what Google can't find.

The SEO industry has spent twenty years building tools for the gap between *Indexed* and *Ranking*: keyword research, content optimization, backlink analysis, technical audits. All valuable. All predicated on Google having indexed your URLs in the first place.

Beacon is the prior-question tool. It checks **stage zero** before you spend on **stage three**.

| Stage | What it means |
|---|---|
| Published | The URL exists on your server. Returns 200. |
| Submitted | The URL is in your sitemap and GSC knows about it. |
| Crawled | Google has fetched the page at least once. |
| Indexed | Google has decided the page is worth showing in results. |

Beacon shows you which stage every URL in your sitemap is at. That's the whole tool.

### Why You Might Want This

- **You manage a site and want to know if Google has the URLs from your sitemap.** GSC tells you per-URL but doesn't roll it up — Beacon does.
- **You're an agency or freelancer auditing a client.** Run Beacon locally, share the export. No vendor lock-in, no client data in third-party SaaS.
- **You're diagnosing why traffic is flat.** Beacon surfaces the gap between *what you think you've published* and *what Google has crawled and indexed*.
- **You don't want to pay $99-200/mo for an SEO suite to see this one screen.** Fair.

### What It Is *Not*

- Not a replacement for Search Console (use both)
- Not a keyword research tool
- Not a backlink analyzer
- Not a content optimizer
- Not a ranking tracker

Beacon does one thing: shows you the delta between your sitemap and Google's index.

---

## Prerequisites

- **Docker** with Compose v2 (`docker compose version`)
- **A Google account** with access to at least one Search Console property
- **~10 minutes** for first-time OAuth setup

---

## Quick Start

You need Docker, a Google account, and ~10 minutes for first-time setup. Once configured, scans take 30–120 seconds for typical sites.

### Step 1: Install Docker (one-time, if you don't already have it)

Beacon runs in Docker, which means you don't have to install Python, Node.js, or any other dependencies.

- [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/)
- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
- [Docker Engine for Linux](https://docs.docker.com/engine/install/)

After installing, open Docker Desktop once to make sure it's running. You'll see a whale icon in your menu bar (Mac) or system tray (Windows) when active.

Verify with:

```bash
docker --version
docker compose version
```

If both return version numbers, you're ready.

### Step 2: Clone the repo

```bash
git clone https://github.com/brianonai/beacon.git
cd beacon
```

### Step 3: Create your `.env` file

The repo includes a template called `.env.example`. Copy it to `.env`, which is where you'll put your actual credentials. The `.env` file is gitignored — your secrets stay on your machine.

**PowerShell (Windows):**

```powershell
Copy-Item .env.example .env
```

**Bash (Mac/Linux):**

```bash
cp .env.example .env
```

### Step 4: Add your Google OAuth credentials to `.env`

Open `.env` in any text editor. Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET`. The walkthrough is in [Google OAuth Setup](#google-oauth-setup) below.

**This repository’s Docker Compose** uses host ports **13000** (web) and **18080** (API) so Windows users avoid Hyper-V reserved port ranges on `:8000`. The template already sets:

- `OAUTH_REDIRECT_URI=http://localhost:18080/auth/google/callback`
- `POST_LOGIN_REDIRECT=http://localhost:13000/`
- `ALLOWED_ORIGIN=http://localhost:13000`

`OAUTHLIB_INSECURE_TRANSPORT=1` must stay on for local HTTP. **Never enable that on a public server.**

### Step 5: Start Beacon

```bash
docker compose up -d
```

The first run takes a minute or two while Docker pulls images. Subsequent starts are nearly instant.

### Step 6: Open it

**[http://localhost:13000](http://localhost:13000)**

Click **Connect Search Console**, authorize Beacon, and run your first scan.

---

## Google OAuth Setup

This is a one-time setup (~5 minutes). You're creating an OAuth client that lets Beacon read your Search Console data on your behalf. **Beacon never stores your Google password** — only OAuth tokens in a signed session cookie after you authorize.

### Step 1: Create a Google Cloud Project

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Click the project dropdown at the top → **New Project**
3. Name it anything (e.g., "Beacon Local")
4. Click **Create** and wait ~30 seconds
5. Make sure the new project is selected in the project dropdown

### Step 2: Enable the Search Console API

1. In the left sidebar: **APIs & Services → Library**
2. Search for **"Google Search Console API"**
3. Click it, then click **Enable**

Without this, you may get a confusing error at scan time instead of during OAuth.

### Step 3: Configure OAuth Consent Screen

1. **APIs & Services → OAuth consent screen**
2. Choose **External** → Create
3. Fill in **App name**, **User support email**, **Developer contact**
4. Click **Save and Continue** through scopes (defaults ok). Under **Test users**, add your Google account if the app stays in testing.
5. Optionally **Publish App** if you want to remove the 100-user test cap (Beacon is still local-only).

### Step 4: Create OAuth Credentials

1. **APIs & Services → Credentials**
2. **+ Create Credentials → OAuth client ID**
3. **Application type**: Web application
4. **Name**: Beacon Local (or anything)
5. **Authorized redirect URIs** — add **exactly** (matches this repo’s Compose defaults):

   ```
   http://localhost:18080/auth/google/callback
   ```

6. Click **Create** and copy the **Client ID** and **Client Secret**

### Step 5: Paste into `.env`

```bash
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
SESSION_SECRET=your-random-32-char-string
OAUTHLIB_INSECURE_TRANSPORT=1
OAUTH_REDIRECT_URI=http://localhost:18080/auth/google/callback
POST_LOGIN_REDIRECT=http://localhost:13000/
ALLOWED_ORIGIN=http://localhost:13000
```

Save the file.

### Step 6: Restart Beacon

```bash
docker compose restart
```

Open `http://localhost:13000` and sign in again.

You may see **Google hasn't verified this app**. Click **Advanced → Go to … (unsafe)**. Expected for a personal OAuth client.

---

## Which Google APIs Does Beacon Use?

Beacon uses the **Search Console URL Inspection API** (read-only) for per-URL indexing state. Beacon does **not** use the Indexing API to request crawls in V1.

### Quotas

URL Inspection is limited (on the order of **~2,000 inspections per day per property** — confirm current limits in Google’s docs). Each Beacon scan inspects every URL in your chosen sitemap once.

| Sitemap size | Rough daily scan budget |
|---|---|
| Up to ~100 URLs | Many re-scans |
| Up to ~500 URLs | Fewer |
| Near quota limit | Plan partial sitemaps or stagger days |

For large sites, prefer **segment sitemaps** (blog vs products). See the [Chilistation write-up](https://brianonai.com/blog/i-spent-five-months-building-a-content-rich-recipe-site-google-had-indexed-7-percent-of-it).

---

## How To Run a Scan

1. **Pick a property** from the dropdown (sites verified in your Search Console).
2. **Sitemap discovery** — Beacon checks `robots.txt` for `Sitemap:`, then common paths. Paste a URL if auto-discovery misses.
3. **Run scan** — sitemap is parsed (including one-level sitemap indexes), each URL is inspected via GSC, then HTTP-checked.
4. **Progress** — two phases: GSC inspection and page checks (hidden when loading from cache).
5. **Results** — states include Indexed, Unknown, Discovered-not-indexed, Crawled-not-indexed, Excluded, Errors, and **phantom** URLs (404 while not indexed).
6. **Filters** — chips above the table; row links open **GSC URL Inspection** where available.
7. **Export CSV** — for analysis or client handoff.

### Reading the Results — Common Patterns

| Pattern | Likely meaning | What to do |
|---|---|---|
| Lots of **Unknown** | New site or sitemap not crawled yet | Wait, re-scan, submit sitemap in GSC |
| Lots of **Discovered / Crawled-not-indexed** | Quality/selectivity signals | Content, internal links, differentiation |
| **Phantom** URLs | Sitemap lists dead pages | Remove from sitemap |
| High **Excluded** | Often canonical / noindex | Verify intentional |

---

## Configuration Reference

| Variable | Required? | Default | Purpose |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | — | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | OAuth client secret |
| `SESSION_SECRET` | Yes | — | Signs session cookies (32+ random chars) |
| `OAUTHLIB_INSECURE_TRANSPORT` | Yes (local HTTP) | `1` | **Localhost only** |
| `OAUTH_REDIRECT_URI` | Yes (Docker defaults) | see `.env.example` | Must match Google Console |
| `POST_LOGIN_REDIRECT` | Yes | `http://localhost:13000/` | After OAuth callback |
| `ALLOWED_ORIGIN` | Yes | `http://localhost:13000/` | CORS for the web app |
| `INSPECT_CONCURRENCY` | No | `10` | Parallel GSC inspections |
| `INSPECT_JITTER_MS` | No | `100` | Delay jitter between batches |
| `STALE_DAYS` | No | `180` | UI “stale” threshold |
| `PAGE_CHECK_CONCURRENCY` | No | `5` | Parallel HTTP page fetches |
| `USER_AGENT` | No | `BeaconBot/0.1…` | UA for page checks |
| `MAX_REDIRECTS` | No | `5` | Max redirects per URL |
| `MICROLINK_API_KEY` | No | — | Optional Microlink Pro key for previews |
| `BEACON_TELEMETRY` | No | `false` | Reserved for optional install ping |

### Ports (this repo)

| Service | Host port | Container | Override |
|---|---|---|---|
| Web (Next.js) | **13000** | 3000 | `docker-compose.yml` ports mapping |
| API (FastAPI) | **18080** | 8000 | Same — **OAuth redirect must use 18080** on the host |

---

## Troubleshooting

Short fixes live here; expanded steps: [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md).

### "OAuth Error: insecure_transport"

Add `OAUTHLIB_INSECURE_TRANSPORT=1` to `.env`, restart: `docker compose restart`.

### "redirect_uri_mismatch"

The Console **Authorized redirect URI** must match **`OAUTH_REDIRECT_URI`** exactly, including `http`, port **18080**, path **`/auth/google/callback`**, and **no trailing slash**.

### No properties in dropdown

Your Google user must be an owner or full user of at least one Search Console property.

### All URLs "Unknown"

New site, or **wrong property variant** (www vs apex, http vs https). Pick the property that matches your sitemap.

### Docker port conflicts

Change host ports in `docker-compose.yml`, then update `OAUTH_REDIRECT_URI`, `ALLOWED_ORIGIN`, `POST_LOGIN_REDIRECT`, and the Google Cloud redirect URI to stay consistent.

### More help

Open a GitHub issue with OS, Docker version, Beacon version, and **redacted** `docker compose logs api` / `web`.

---

## Privacy

- Runs on your hardware; scan payloads stay in your browser session and optional **localStorage** cache (same machine).
- OAuth tokens live in a **signed** HTTP-only session cookie (`SESSION_SECRET`).
- API traffic goes to **Google** and to **URLs you scan** (HTTP checks). Optional **Microlink** for site previews.
- **`BEACON_TELEMETRY`**: recognized in config; **no telemetry request is sent by the app today** (endpoint reserved).

Full detail: [`docs/PRIVACY.md`](docs/PRIVACY.md).

---

## About

Beacon is built and maintained by [Brian Diamond](https://brianonai.com).

**If you find it useful:**

- 📬 **[The CAIO Brief](https://thecaiobrief.substack.com)** — AI governance & technical diligence
- 🔗 **[LinkedIn](https://linkedin.com/in/brianpdiamond)**
- 🛠️ **[Contact](https://brianonai.com/contact)** — fractional CAIO, governance, indexing at scale
- ⭐ **Star the repo** on GitHub

### Roadmap

- ✅ V1: sitemap vs GSC delta, page checks, CSV export, local scan cache
- 🚧 V2: scan history, week-over-week deltas, scheduled scans + email
- 💭 Beacon Cloud: [waitlist](https://brianonai.substack.com/p/beacon-cloud-get-notified-when-its)

### License

MIT.

---

## More documentation

- [`docs/INSTALLATION.md`](docs/INSTALLATION.md) — deep install walkthrough
- [`docs/USAGE.md`](docs/USAGE.md) — end-to-end scan guide
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) — errors and OS quirks
- [`docs/PRIVACY.md`](docs/PRIVACY.md) — data, cookies, cache, Google visibility
