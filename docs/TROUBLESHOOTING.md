# Beacon — Troubleshooting

Symptoms first, then fixes. Always check **`docker compose logs api`** and **`docker compose logs web`** after reproducing. This repo defaults to **web on 13000** and **API on 18080** on the host.

---

## OAuth & auth

### `insecure_transport` / OAuth insecure transport error

**Cause:** `oauthlib` blocks non-HTTPS redirect URIs unless opted in.

**Fix:** In `.env`:

```env
OAUTHLIB_INSECURE_TRANSPORT=1
```

Restart: `docker compose restart`. **Never** set this on a public HTTPS deployment.

---

### `redirect_uri_mismatch`

**Cause:** Google’s **Authorized redirect URIs** do not match what Beacon sends.

**Fix:**

1. Google Cloud Console → **Credentials** → your OAuth client.
2. Add **exactly**:

   `http://localhost:18080/auth/google/callback`

3. Match `.env`:

   `OAUTH_REDIRECT_URI=http://localhost:18080/auth/google/callback`

No trailing slash. `http` not `https` for local Docker. Port **18080**, path **`/auth/google/callback`**.

---

### “Google hasn’t verified this app”

**Not a bug.** Personal / unverified OAuth clients always show this.

**Fix:** **Advanced** → proceed to your app name. You are the developer and the user.

---

### After login, immediately logged out / 401 on `/api/*`

**Causes:**

- `SESSION_SECRET` changed between requests (revert or stay stable).
- Browser blocks third-party cookies *(should not apply — same-origin via Next proxy)*.
- Clock skew *(rare)* — check OS time.

**Fix:** Set a long random `SESSION_SECRET`, restart API, clear cookies for `localhost`, try again.

---

### No properties in dropdown

**Cause:** The signed-in Google user has **no Search Console properties**, or the OAuth app is in **Testing** and the user is **not** listed as a test user.

**Fix:** Verify a property in GSC; add the user under **Test users**; or **Publish** the OAuth app.

---

## Google API errors

### API not enabled / “Search Console API has not been used…”

**Fix:** Cloud Console → **Library** → enable **Google Search Console API**. Wait a few minutes and retry.

---

### Quota exceeded / 429-like behavior mid-scan

**Cause:** URL Inspection daily quota per property.

**Fix:** Smaller sitemaps, fewer scans per day, or wait for reset. See README **Quotas**.

---

## Scan behavior

### Every URL shows Unknown

**Common causes:**

1. **Brand-new site** — Google hasn’t integrated the sitemap yet (wait ~1–2 weeks, re-scan).
2. **Wrong property** — e.g. `sc-domain:example.com` selected but sitemap is `www.example.com` with a separate GSC property.
3. **Sitemap lists URLs on a host Google doesn’t associate with that property**.

**Fix:** Re-verify property variant; open one URL in GSC’s URL Inspection manually to compare.

---

### “Things that look like bugs but aren’t”

- **Cache restore on F5:** By design — banner says **Loaded from cache**. Use **Re-scan** for a live run.
- **Progress bars hidden when cached:** By design.
- **Microlink preview errors:** Preview uses Microlink; apex vs `www` may differ until redirects resolve — check the **debug** foldout on the card.

---

## Sitemap discovery

### “No sitemaps found”

**Fix:** Paste sitemap URL. Try:

- `/sitemap.xml`
- `/sitemap_index.xml`
- `/wp-sitemap.xml` (WordPress)
- `/sitemap-index.xml`

---

## Docker & networking

### Port already allocated / bind error

**Fix:** Stop the conflicting process or edit `docker-compose.yml` host ports. Then update **`.env`** (`OAUTH_REDIRECT_URI`, `ALLOWED_ORIGIN`, `POST_LOGIN_REDIRECT`) and the **Google redirect URI** to match.

---

### Windows: path or line-ending oddities

- Prefer **PowerShell** examples from the README when copy/pasting.
- If a script saved `.env` as UTF-16 by accident, re-save as **UTF-8** without BOM in VS Code / Notepad++.

---

### macOS: Docker not starting

**Fix:** Ensure Docker Desktop has granted permissions (network, file sharing). Reinstall if the VM fails to boot.

---

### Linux: permission denied on Docker socket

**Fix:** `sudo usermod -aG docker $USER` then re-login, or prefix with `sudo` temporarily.

---

## Logs & support bundle

When opening an issue, include:

- Beacon **version** (footer or `package.json`)
- **OS** + **Docker** version
- **Redacted** `docker compose logs api` snippet (remove tokens)
- Expected vs actual behavior

---

## Related docs

- **INSTALLATION.md** — first-time setup
- **USAGE.md** — interpreting results
- **PRIVACY.md** — what leaves the machine
