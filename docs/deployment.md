# Deployment

The public demo uses GitHub Pages for the static frontend and the existing Render Free service for FastAPI. The canonical address is **https://www.gamebuddyagent.site/**. Reuse the existing domain; deployment does not require buying another domain or upgrading hosting.

## Backend on Render

Create from `render.yaml`, or update the existing service manually:

- Root Directory: leave empty (repository root).
- Build Command: `pip install -r backend/requirements.txt`
- Start Command: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`
- Instance: Free.

The repository root is needed because retrieval fixtures live in `samples/`, outside `backend/`. Editing `render.yaml` alone does not update a manually created service.

Set these environment variables:

```env
GAMEBUDDY_ENV=production
BACKEND_CORS_ORIGINS=https://www.gamebuddyagent.site
GAMEBUDDY_STORAGE_DURABILITY=ephemeral
GAMEBUDDY_MAX_REQUEST_BYTES=262144
```

Anonymous visitors can use state analysis, grounded Q&A and reviews. Requests use the built-in policy, ignore identity fields, do not read or write personal history or traces, and do not call an external model. Screenshot analysis requires private access and remains a placeholder recognizer.

Private Ops, history, policy editing, evaluations and exports require a server-side `GAMEBUDDY_ADMIN_TOKEN`. Generate a long random token and set it only in Render's secret environment settings. Enter the same token in the website's administrator access panel; it is kept in that browser tab's session storage and sent only to the configured API origin. Never place it in Git, URLs, screenshots, build output or a `NEXT_PUBLIC_*` variable. Without a configured token, private endpoints return 503; an absent or invalid token returns 401 when private access is configured. This is single-operator access, not multi-user authentication.

`OPENROUTER_API_KEY` and MongoDB are optional for private use. They are not needed for the public demo. MongoDB covers profile/history/feedback only; it does not make SQLite-backed Ops data durable.

Render Free sleeps after idle periods and may need about a minute to wake. Its filesystem is ephemeral: SQLite data can disappear on restart, redeploy or sleep. Do not promise durable online history on this plan. Export private data before planned redeployments. The health response reports `mode`, `private_access` and declared `storage` so the UI can explain this limitation. See [Render Free documentation](https://render.com/docs/free).

## Frontend on GitHub Pages

In repository settings, set Pages source to GitHub Actions and the Actions repository variable:

```env
NEXT_PUBLIC_API_BASE_URL=https://gamebuddy-agent-backend.onrender.com/api/v1
```

The deployment workflow validates that this is an HTTPS public URL ending in `/api/v1`. Missing configuration or a loopback address fails the build. This value is embedded at build time: changing the variable requires rebuilding Pages.

Both `CNAME` files use `www.gamebuddyagent.site`. Keep `www` pointed to GitHub Pages and enable HTTPS enforcement after its certificate is approved. Configure the apex domain separately if it should redirect to `www`; verify its DNS and certificate before advertising it.

## Verification

1. Confirm the Render deploy is live on the intended commit.
2. Open `/health` and expect `status: ok`, `mode: public`, `storage: ephemeral`.
3. Open `https://www.gamebuddyagent.site/assistant/`, wait for the backend connection, and submit a grounded question.
4. Confirm anonymous Ops/history access is denied; use an administrator token only if private access is configured.
5. Confirm playable games still work without the API.

## Local startup on Windows

Install `backend/requirements.txt` and build the frontend once with `npm ci` then `npm run build` in `frontend/`. Build locally without the production API environment variable to use the local backend fallback. From the repository root:

```powershell
.\scripts\start-local.ps1
```

This starts hidden background servers on `127.0.0.1:8000` and `127.0.0.1:3000`, records logs/PIDs under ignored `.runtime/`, and reuses healthy servers. They run until stopped or Windows exits. Open `http://127.0.0.1:3000/assistant/` or `/ops/`. Use `-BackendOnly` when the frontend is already running.

```powershell
.\scripts\stop-local.ps1
```

The stop script checks each recorded process belongs to this project's launcher before stopping it. Local development keeps full private features and persistent SQLite storage. The connection panel checks `/health`, distinguishes API configuration errors from unreachable servers, and offers retry.
