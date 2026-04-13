# GameBuddy Agent

GameBuddy Agent is a local-first game analysis web app. It accepts a structured game state or a screenshot placeholder input, then returns:

- a short situation summary
- a phase read and recommended direction
- tactical advice
- a beginner-friendly explanation
- a review-style breakdown of likely mistakes and next steps

This repository also includes several browser-playable prototype modules in `/play`.

## What This Project Is

GameBuddy Agent is a strategy and review tool.

It is built for:

- post-match review
- situation explanation
- lightweight coaching
- experimenting with agent-style orchestration for game analysis

It is not built for:

- cheats
- automation bots
- memory reading
- input injection
- anti-cheat evasion

## Current Scope

Analysis demos:

- Pokemon-style turn-based battle demo
- MOBA post-match demo
- RPG build demo

Browser-playable modules:

- Heroes & Monsters Web
- MOBA Sandbox
- RPG Build Lab
- Mini Survivor Mode

## How It Works

Backend flow:

1. Normalize input into a game-specific state.
2. Run game-pack analysis logic.
3. Optionally enhance the result with OpenRouter.
4. Return a stable response shape to the frontend.

Main backend pieces:

- `backend/app/api/routes/`
- `backend/app/services/orchestrator.py`
- `backend/app/services/game_packs.py`
- `backend/app/services/openrouter_client.py`

Frontend pieces:

- `frontend/app/`
- `frontend/components/`
- `frontend/lib/`

## Features

- Structured state analysis via `POST /api/v1/analyze/state`
- Screenshot placeholder analysis via `POST /api/v1/analyze/screenshot`
- Phase prediction and recommended direction output
- Review report output
- English and Chinese UI
- Local sample states for demos
- Optional OpenRouter integration
- Browser-playable prototype pages

## OpenRouter

OpenRouter support is optional.

If `OPENROUTER_API_KEY` is set, the backend can enhance heuristic analysis with an LLM response. If it is not set, the app falls back to the built-in rule-based path.

Example environment variables:

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=GameBuddy Agent
```

## Quick Start

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open:

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`

## Docker

```bash
docker compose up --build
```

## API

Routes:

- `GET /health`
- `POST /api/v1/analyze/state`
- `POST /api/v1/analyze/screenshot`

See [docs/api.md](docs/api.md) for the request and response shape.

## Example Data

Sample game states:

- `samples/game-states/balanced-position.json`
- `samples/game-states/moba-comeback-window.json`
- `samples/game-states/rpg-mage-build.json`
- `samples/game-states/defensive-stall-break.json`
- `samples/game-states/closing-out-a-lead.json`

Placeholder asset:

- `frontend/public/demo/placeholder-battle.svg`

## Documentation

- [docs/architecture.md](docs/architecture.md)
- [docs/agents.md](docs/agents.md)
- [docs/api.md](docs/api.md)
- [docs/future-roadmap.md](docs/future-roadmap.md)

## Tests

```powershell
cd backend
pytest
```

## Notes

- Screenshot analysis is still a placeholder path, not a full vision system.
- The project favors explicit system boundaries over pretending to do more than it actually does.
- Some game modules are analytical demos, while others are playable frontend prototypes.

## Contributing

Contributions are welcome.

Good contributions usually include:

- a clear user-facing problem
- matching docs updates when behavior changes
- sample data updates when a demo format changes
- tests for backend response-shape or logic changes
