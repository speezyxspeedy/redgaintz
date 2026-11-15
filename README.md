Live demo: https://<github-user>.github.io/<repository>/ (deployment pending)

# TERRASCAN — Vidarbha Earth System Trend Detective

## Title / Problem

TERRASCAN helps investigate long-term Earth-system trends for Vidarbha, Maharashtra. It uses NASA POWER's daily corrected precipitation (`PRECTOTCORR`, mm/day) as a region-scale fallback and clearly labels its coarse grid. It does not claim that a trend causes an observed impact.

## Team

NASA Space Apps Challenge 2026 · NASA Space Apps Nagpur. Add the human team members and roles before submission.

## Solution & Architecture

- `frontend/`: Vite, React, TypeScript, CesiumJS study-area explorer.
- `pipeline/`: Python data retrieval, validation, spatial mask, aggregation, and trend statistics.
- `config/` and `schemas/`: dataset/region registry and JSON contracts.
- `boundaries/`: geoBoundaries ODC-ODbL India district source products for Vidarbha.
- `artifacts/`: immutable result JSON and run index consumed by the static frontend.
- `data/raw/`: downloaded bytes and sidecars; ignored by Git.
- `pipeline/api.py`: optional FastAPI endpoint for live runs. The static app reads precomputed artifacts without it.

Only the NASA POWER `PRECTOTCORR` adapter is enabled. Earthdata products remain disabled until their official collection, variable, units, and access details are verified. No sample or synthetic values are presented as science results.

## Live Demo & Screenshots

Live URL placeholder: `https://<github-user>.github.io/<repository>/`. Static GitHub Pages deployment is configured in `.github/workflows/pages.yml`; replace the placeholder only after a repository is connected and Pages deployment succeeds. A real NASA POWER run for 2001–2025 is bundled under `artifacts/`; the app labels a result loaded from static artifacts as `Cached`.

The app's empty/offline state is intentional when no real cached run is present.

## Install / Setup

Requirements: Node.js 20+, Python 3.11+, and `make` (or run the commands below individually).

```sh
py -3.11 -m venv .venv
# Activate .venv, then:
python -m pip install -e ".[test]"
npm install
npm run dev
```

In another terminal, optional API:

```sh
python -m uvicorn pipeline.api:app --reload --port 8000
python scripts/dt1_single_point.py --start 2026-01-01 --end 2026-02-28
python -m pipeline.run --region IN-MH-VID --start-year 2001 --end-year 2025
make test
```

Copy `.env.example` to `.env` for optional settings. Keep Earthdata credentials in `.env`, never in `VITE_*` variables. Cesium ion's browser token is public by design; restrict it to the deployed domain and required assets. Offline operation requires a previously generated real result in `artifacts/`.

The bundled result spans 2001–2025; rerun the analysis command if the NASA POWER source or date range changes. Raw daily regional responses and their sidecars are stored in ignored `data/raw/`; each raw input hash and the aggregate checksum are recorded in the run provenance. The workspace is not connected to a Git repository, so the recorded code Git SHA is `null`.

## AI Usage Disclosure

GitHub Copilot assisted with code scaffolding, tests, documentation, and UI implementation. Human review and real-data verification are required before scientific or competition submission.

GitHub Copilot also assisted with the interactive CesiumJS world-map district label plotter (dynamic GeoJSON centroid computation, land markers, hover cursor). Human review confirmed coordinate accuracy against known district capitals.
