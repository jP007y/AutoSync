# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

AutoSetup is an MVP (Portuguese / Brazil) for vehicle customization and predictive maintenance: it evaluates a proposed modification (suspension, wheels, exhaust, etc.) against a vehicle's spec sheet and returns the cascade of affected systems, consequences, safety risk, legality under Brazilian law (CTB / CONTRAN / CONAMA) and a score. It also has a marketplace side: two user types (`consumidor` and `prestador`), where service providers (oficinas/lojas) manage a store profile and service posts. Code, comments, identifiers and UI text are all in Portuguese. Keep new code in that style.

## Running

There is no build step, linter or test suite.

Backend (FastAPI + SQLAlchemy + SQLite). Run from inside `backend/`, because imports are top-level (`from database import ...`, `from models.vehicle import ...`):

```
pip install -r Requeriments.txt
uvicorn api.main:app --reload --port 8000
```

- API docs are at `http://localhost:8000/docs`.
- The same process also serves the frontend statically at `http://localhost:8000/site/` (for example `/site/login.html`). That mount has to stay the last thing in `api/main.py`, after all routes. It lets phones on the same Wi-Fi open the site through the QR page (`qr.html` + the `/rede` endpoint, which returns the machine's LAN IP).
- On startup the API creates the tables (`init_db`) and seeds vehicles and demo stores (`seed_vehicles`, `seed_stores`). The DB file is `backend/database/autosetup.db` (gitignored). `DATABASE_URL` overrides it. Delete the file to reset.

Frontend only: open `frontend/index.html` directly or with any static server. Pages that call the API need the backend running.

Regenerate the SVG car and service illustrations (run from `backend/`; the script imports `models.store.LOJAS_SEED`):

```
python ../tools/gerar_imagens.py
```

The site loads `<name>.jpg` first and falls back to `<name>.svg`, so real photos can be dropped in alongside the SVGs.

Deploy: pushing to `main` publishes `frontend/` to GitHub Pages (`.github/workflows/pages.yml`). Only the static frontend is deployed, never the backend.

## Architecture

**Frontend** (`frontend/`): plain HTML/CSS/vanilla JS with no bundler or modules. Each JS file defines a global IIFE namespace (`AutoSetupApi`, `AutoSetupAuth`, `AutoSetupEngine`, ...) or a `window.AUTOSETUP_*` data global, so `<script>` order in each HTML page matters (data → engine → util/api → Auth → page script). Three.js r128 and OrbitControls are loaded from a CDN for the 3D "Raio-X" vehicle view (`raio-x-3d.js`, used by `raio-x.html` and the preview in `index.html`).

- `js/api.js` works out the API base URL from `window.location`: `file://` → `localhost:8000`; port 8000 or `/site/` → same origin; any other port → same host on port 8000. Keep this logic when adding endpoints.
- `js/Auth.js` stores the logged-in user in `localStorage` (`autosetup_usuario`). There are no tokens. Pages route by user type (consumer vs. provider pages such as `painel-prestador.html`).
- **The modification-evaluation logic currently runs in the frontend**: `js/rules-engine.js` is a deterministic rules engine that reads the legal limits in `data/regulamentacao.js`. Its output shape (`cascata`, `consequencias`, `risco`, `legalidade`, `score`) is the contract the UI renders. The header of `rules-engine.js` mentions `data/veiculos.js`, but that file does not exist; vehicle data now comes from the API (`/veiculos/{id}`).

**Backend** (`backend/`):

- `api/main.py` holds all routes: auth (register/login with salted password hashes in `models/user.py`), vehicles, stores, provider store/posts CRUD, access stats, and `/rede`.
- `models/` contains the SQLAlchemy models plus the seed data.
- `services/` (`cascade.py`, `legality.py`, `compatibility.py`, `maintenance.py`) are empty placeholders. The planned next step is to move the rules engine from `rules-engine.js` into these services and expose it through the API, keeping the same output format. The README states that this core logic belongs in the backend, not in the HTML.
- `Ai/Ai_client.py` is an experimental, not-yet-wired alternative to the rules engine. `analisar_modificacao()` calls a local Ollama model (`phi3:mini` at `localhost:11434`) using `Prompts/system_prompt.txt`, then normalizes and extracts JSON in the same output shape. It needs `requests`, which is not listed in `Requeriments.txt`. No API key is needed.
