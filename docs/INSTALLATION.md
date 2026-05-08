# Beacon — Installation guide

This document is the long-form companion to the root **README**. Follow it when you want every step explained, recovery paths for common failures, and OS-specific notes. Goal: you should not need to leave this file to get Beacon running.

---

## 1. What you are installing

Beacon ships as two **Docker** services:

- **API** — FastAPI, OAuth, Google Search Console + URL Inspection, SSE scan stream, HTTP page checks.
- **Web** — Next.js UI that proxies `/api` and `/auth` to the API so cookies stay same-origin.

Default **host** ports in this repo:

| Service | URL you open | Purpose |
|---------|----------------|--------|
| Web | `http://localhost:13000` | Browser UI |
| API | `http://localhost:18080` | OAuth callback + REST (you rarely open this directly) |

Why not 3000 and 8000? On many Windows setups, Hyper-V reserves certain ranges and binding to **8000** fails with “forbidden by access permissions.” This repo maps **18080→8000** inside the API container so the app still listens on 8000 internally.

---

## 2. Install Docker

### Windows

1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. Run the installer. Enable **WSL 2** backend when prompted (recommended).
3. Reboot if the installer asks.
4. Start Docker Desktop from the Start menu. Wait until the whale icon is steady in the tray.
5. Open **PowerShell** (not necessarily admin) and run:

   ```powershell
   docker --version
   docker compose version
   ```

   Both commands should print version strings.

**If `docker` is not recognized:** Docker Desktop is not running or not on PATH. Launch Docker Desktop and retry.

### macOS

1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) (Apple Silicon or Intel as appropriate).
2. Drag to Applications, open Docker, complete the onboarding.
3. Terminal:

   ```bash
   docker --version
   docker compose version
   ```

**Apple Silicon:** Docker Desktop runs arm64 images; Beacon’s Node and Python base images are multi-arch. No Rosetta required for Beacon itself.

### Linux

Install the [Docker Engine](https://docs.docker.com/engine/install/) for your distribution (Ubuntu, Debian, Fedora, etc.) and the [Compose plugin](https://docs.docker.com/compose/install/linux/).

Post-install: add your user to the `docker` group if you do not want `sudo`:

```bash
sudo usermod -aG docker $USER
```

Log out and back in, then verify `docker run hello-world`.

---

## 3. Clone the repository

```bash
git clone https://github.com/brianonai/beacon.git
cd beacon
```

**Path with spaces:** Prefer a path without spaces on Windows to avoid rare tooling bugs: e.g. `C:\src\beacon`.

---

## 4. Create `.env` from `.env.example`

**PowerShell:**

```powershell
Copy-Item .env.example .env
```

**Bash:**

```bash
cp .env.example .env
```

**Line endings:** If you edit `.env` on Windows and deploy on Linux, use LF endings in editors that offer the choice. Mixed endings rarely break Python dotenv, but consistency helps.

Never commit `.env`. It is listed in `.gitignore` alongside `.env.local` and `*.env.backup`.

---

## 5. Fill in required variables

Open `.env` and set at minimum:

| Variable | What it is |
|----------|------------|
| `GOOGLE_CLIENT_ID` | OAuth "Client ID" from Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth “Client secret” |
| `SESSION_SECRET` | Long random string — signs cookies; treat like a password |

Generate `SESSION_SECRET`:

**PowerShell:**

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
```

**macOS / Linux:**

```bash
openssl rand -base64 36
```

Keep the Docker-oriented defaults unless you changed ports in `docker-compose.yml`:

```env
OAUTH_REDIRECT_URI=http://localhost:18080/auth/google/callback
POST_LOGIN_REDIRECT=http://localhost:13000/
ALLOWED_ORIGIN=http://localhost:13000
OAUTHLIB_INSECURE_TRANSPORT=1
```

---

## 6. Google Cloud — full OAuth walkthrough

### 6.1 Project

1. [Google Cloud Console](https://console.cloud.google.com/) → project picker → **New project**.
2. Name it (e.g. `beacon-local`) → **Create**. Select that project.

### 6.2 Enable Search Console API

**APIs & Services → Library →** search **Google Search Console API** → **Enable**.

Skipping this leads to **API not enabled** or opaque errors when the backend calls Google.

### 6.3 OAuth consent screen

**APIs & Services → OAuth consent screen**

- User type: **External** (typical for individual use).
- Fill app name, support email, developer contact.
- Scopes: default is fine for the library flow Beacon uses; you can add `.../auth/webmasters.readonly` explicitly if you follow Google’s scope UI.
- **Test users:** while in “Testing” mode, add your own Gmail.

**Publishing:** Publishing the app removes the “100 test users” cap. You will still see “unverified app” when using your own client — that is normal.

### 6.4 OAuth client (Web)

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Type: **Web application**.
- **Authorized redirect URIs** — one line, exactly:

  `http://localhost:18080/auth/google/callback`

No `https` for this dev setup. No trailing slash. Port **18080** matches `docker-compose.yml`.

Copy **Client ID** and **Client secret** into `.env`.

### 6.5 Restart containers

From the repo root:

```bash
docker compose up -d
```

or after changing `.env`:

```bash
docker compose restart
```

---

## 7. First launch

1. Open **http://localhost:13000**
2. Click **Connect Search Console** (or equivalent sign-in).
3. Approve the consent screen. If you see **Google hasn't verified this app**, expand **Advanced** and proceed — it is your own project.
4. Return to Beacon; you should see the property picker populated with domains you have in Search Console.

**Empty property list:** Your Google account does not have access to any GSC property, or you picked the wrong Google account during OAuth. Add a property in [Search Console](https://search.google.com/search-console) or add a test user to the OAuth app if it is still in Testing mode.

---

## 8. Verify Search Console access

If you have never verified a site:

1. Search Console → **Add property** → Domain or URL-prefix.
2. Complete DNS or HTML file verification per Google’s wizard.
3. Wait until the property appears as verified (can take minutes to hours for DNS).

Beacon only lists properties your user can access.

---

## 9. What happens on the first scan (preview)

1. You choose a **property** and Beacon discovers (or you paste) a **sitemap URL**.
2. The server parses the sitemap and issues **URL Inspection** requests (subject to Google quota).
3. Results stream into the UI; then **HTTP checks** run against each URL (HEAD, GET fallback).
4. You see counts, a table, optional **phantom** (404 + not indexed) rollups, and **Export CSV**.
5. A completed scan may be **cached in your browser** for the same property + sitemap; use **Re-scan** to force a fresh run.

Expect large sitemaps to take proportionally longer.

---

## 10. Local development without Docker (optional)

Advanced users can run **uvicorn** and **next dev** separately; see README “Local development” patterns. You must still configure OAuth redirect to match whatever port runs the API (often `http://localhost:8000/auth/google/callback`) and set `ALLOWED_ORIGIN` / `POST_LOGIN_REDIRECT` to `http://localhost:3000`.

Docker is the supported path for first-time users.

---

## 11. Updates

```bash
git pull
docker compose build --no-cache
docker compose up -d
```

If the API adds new environment variables, compare your `.env` with `.env.example`.

---

## 12. Getting unstuck

If installation fails after this doc:

1. [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) — error strings and OS quirks.
2. GitHub **Issues** on `brianonai/beacon` with logs and version info.

You now have Docker running, `.env` configured, Google OAuth aligned with **port 18080**, and a verified mental model of what “first scan” does.
