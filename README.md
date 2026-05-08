# Beacon

**See what Google actually sees.**

Beacon is a self-hosted sitemap-vs-Google-index delta viewer. Point it at a
Search Console property, it pulls your sitemap, asks the URL Inspection API
about every URL, and shows you the gap.

- Self-hosted. Bring your own Google credentials.
- Stateless — nothing is stored between scans.
- Single `docker-compose up` to run.
- Read-only. Beacon never submits to the Indexing API or modifies your site.

> Built by [Brian Diamond](https://brianonai.com), fractional Chief AI Officer.
> Sister project to [Onaro](https://onaro.io) (AI spend optimization).

---

## Quick start

```bash
git clone <this repo> beacon
cd beacon
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET

docker compose up
# App: http://localhost:13000  (API on host port 18080 — see docker-compose.yml)
# open http://localhost:13000
```

Docker Compose sets `OAUTHLIB_INSECURE_TRANSPORT=1` on the API service so OAuth works on `http://localhost`; remove that when deploying behind HTTPS.

### Get Google OAuth credentials

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth client → **Web application**
3. Authorized redirect URI: `http://localhost:18080/auth/google/callback` (Docker Compose default; avoids Windows reserved port ranges on :8000)
4. Enable the **Search Console API** for the project
5. Paste the client ID/secret into `.env`

### Generate the session secret

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

---

## Architecture

```
┌─────────────┐    /api, /auth     ┌─────────────┐
│  Next.js    │  ◀────proxy───▶    │  FastAPI    │
│  (web)      │                    │  (api)      │
└─────────────┘                    └──────┬──────┘
                                          │
                                          ▼
                           Search Console API (read-only)
```

- **Frontend**: Next.js 16, App Router, Tailwind, dark theme
- **Backend**: FastAPI, async, `google-api-python-client` for GSC
- **Auth**: OAuth (read-only `webmasters.readonly` scope) + signed-cookie session
- **Storage**: None
- **Streaming**: Server-Sent Events from `/api/scan` → progressive results

### Why OAuth and not a service account?

Service-account-based GSC access has been broken for new accounts since April
2026 (the `*.iam.gserviceaccount.com email not found` bug). OAuth on the user's
own Google account works around this entirely and only needs read scope.

### Why no database?

V1 is a tool, not a platform. Scans are fresh every time. Adding history,
multi-property dashboards, scheduled re-scans, etc. is V2 territory.

---

## API surface

| Method | Path                       | Purpose                                                     |
|--------|----------------------------|-------------------------------------------------------------|
| GET    | `/auth/google/login`       | Redirect to Google consent                                  |
| GET    | `/auth/google/callback`    | OAuth callback; sets signed cookie                          |
| POST   | `/auth/logout`             | Clear session                                               |
| GET    | `/auth/me`                 | 200 if signed in, 401 otherwise                             |
| GET    | `/api/properties`          | List the user's GSC properties                              |
| GET    | `/api/preview?url=`        | Site preview (microlink.io; auth required)                  |
| POST   | `/api/discover`            | Find sitemap(s) for a property; return URL inventory        |
| POST   | `/api/scan`                | SSE stream of URL inspection results (and final summary)    |

SSE event names from `/api/scan`: `started`, `progress`, `page_check_started`, `page_check_progress`, `page_check_done`, `done`, `error`.

---

## Local development

Backend:

```bash
cd api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd web
npm install
npm run dev
```

The Next.js dev server proxies `/api/*` and `/auth/*` to `http://localhost:8000`
so cookies stay same-origin.

For OAuth over `http://localhost`, set `OAUTHLIB_INSECURE_TRANSPORT=1` in `.env` (see `.env.example`). Docker Compose sets this for the API container automatically.

---

## Roadmap

V1 (this repo): stateless delta viewer, OAuth-only, CSV export.

V2 (TBD):
- Scan history (SQLite local / Postgres team)
- Visual coverage maps (treemap by URL section)
- Scheduled re-scans + change alerts
- Hosted SaaS tier on top of the same engine

---

## License

MIT.
