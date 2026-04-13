# Deployment

This project is split into two deploy targets:

- frontend: GitHub Pages
- backend: Render

## 1. Deploy the backend on Render

Use the repository root and let Render read `render.yaml`, or create the service manually with these values:

- Root Directory: `backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/health`

Render environment variables:

```env
GAMEBUDDY_ENV=production
BACKEND_CORS_ORIGINS=https://gamebuddyagent.site
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=openrouter/free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=https://gamebuddyagent.site
OPENROUTER_APP_NAME=GameBuddy Agent
```

After deployment, copy the Render backend URL, for example:

```text
https://gamebuddy-agent-backend.onrender.com
```

## 2. Configure GitHub Pages

In the GitHub repository:

1. Open `Settings -> Pages`
2. Set source to `GitHub Actions`
3. Open `Settings -> Secrets and variables -> Actions -> Variables`
4. Add a repository variable named `NEXT_PUBLIC_API_BASE_URL`

Example value:

```text
https://gamebuddy-agent-backend.onrender.com/api/v1
```

The Pages workflow in `.github/workflows/deploy-pages.yml` will inject that value into the frontend build.

## 3. Configure the custom domain

This repo already includes `frontend/public/CNAME` with:

```text
gamebuddyagent.site
```

Point your domain DNS to GitHub Pages according to GitHub's custom-domain instructions.

## 4. Final checks

Once both deployments are live:

- open `https://gamebuddyagent.site`
- confirm the homepage loads
- confirm `/play/` pages work
- submit a state analysis and confirm the frontend reaches the Render backend
- open the backend `/health` URL directly to confirm Render is healthy

## Notes

- GitHub Pages only serves the frontend. It cannot run FastAPI.
- If `NEXT_PUBLIC_API_BASE_URL` is missing in GitHub Actions variables, the deployed frontend will load but analysis requests will fail with a clear configuration error.
- Browser-playable game modules still work even if the backend is temporarily down.
