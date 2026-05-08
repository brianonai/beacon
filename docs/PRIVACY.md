# Beacon — Privacy

Beacon is built for operators who do not want SaaS copies of their crawl data. This document states **what data exists, where it lives, and what leaves your hardware**.

---

## 1. Runtime boundary

In the default **Docker** layout:

- **API** and **Web** run on **your** computer (or your server).
- The **browser** loads the UI from your Next.js container (e.g. `http://localhost:13000`).
- The browser talks to **Google** only through your **local API**, which holds OAuth tokens in an **HTTP-only cookie** after you sign in.

Beacon **does not** run a centralized database in V1 and **does not** upload scan rows to a vendor.

---

## 2. Session cookie

After Google OAuth completes, Beacon sets a session cookie (name configurable via env, default `beacon_session`).

- The cookie payload is **signed** with `SESSION_SECRET` (HMAC-style signing via the web framework stack). It is **not end-to-end encrypted** — anyone who possesses `SESSION_SECRET` could forge sessions, which is why that value must stay secret and random.
- Treat **`SESSION_SECRET` rotation** like password rotation: existing users are logged out when you change it.

**What’s inside:** OAuth refresh/access material the server needs to call Search Console **on your behalf** — still scoped to what you approved on Google’s consent screen.

---

## 3. Local scan cache (browser)

After a **successful** scan, Beacon may store **rows, summary, and optional site preview JSON** in **`localStorage`** under a key derived from property + sitemap URL.

- **Scope:** that browser profile only.
- **Clear:** use **Re-scan** (clears the entry for that pair) or remove site data for `localhost` in browser settings.

If `localStorage` is full or disabled, caching fails silently — scans still work.

---

## 4. Network destinations

| Destination | When | Data |
|-------------|------|------|
| **Google OAuth** | Sign-in | Standard OAuth code exchange; tokens returned to your API |
| **Search Console / URL Inspection APIs** | During scan | URLs from your sitemap, property identifier, inspection responses |
| **Your own website** | Page-check phase | HTTP HEAD/GET to URLs in the sitemap |
| **Microlink** (optional) | Site preview card | Only the homepage/preview URL you configure — proxied server-side through your API when you open the scan page |

---

## 5. Optional telemetry (`BEACON_TELEMETRY`)

`.env` includes `BEACON_TELEMETRY` for future **opt-in** install telemetry (version + OS class, no URLs).

**Current application behavior:** the flag is read into settings, but **no outbound telemetry HTTP request ships in this repository yet**. When implemented, it would **default off** and only run when explicitly enabled.

---

## 6. What Google logs

Every URL Inspection call is associated with **the Google account that authorized Beacon**. Those requests appear in normal Search Console / API activity for that account. This is **expected** — you are using your own quota, not Beacon’s.

---

## 7. Wiping local state

To return to a “clean” machine sense:

1. Delete `.env` (or remove secrets) and rotate Google OAuth client secret if exposed.
2. Clear browser cookies + `localStorage` for your Beacon origin.
3. `docker compose down` and optionally `docker system prune` (removes containers/images — be careful).

There is **no SQLite / Postgres** file in V1 to delete.

---

## 8. Changes in future versions

If Beacon gains server-side history (V2+), this document will add retention rules. Until then: **stateless server, optional browser cache only.**

---

## 9. Contact

Maintainer: **[brianonai.com](https://brianonai.com)** — security-sensitive reports welcome via the contact path listed there.
