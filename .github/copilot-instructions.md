docs/PRD.md is an outdated draft. where it confilicts with this file or the users promt , this file and the promt win. decision : analysis runs in the browser from nasa power (see docs/build plan v2.1.md);
the globe only emmits lat/Lon or reigion selection and dosent fetch data or compute states 
> SUPERSEDED for architecture decisions: see BUILD_PLAN_V2.1.md at the top of docs/PRD.md.


You are helping build TERRASCAN for NASA Space Apps Challenge 2026, "Be An Earth System Trend Detective", at NASA Space Apps Nagpur. The hacking window is 26 hours and ends at a hard code freeze at 02:00 PM Sunday 15 Nov 2026. Prefer the simplest thing that works.

Product: the user picks Vidarbha (11 districts) on a real CesiumJS globe, the app shows a statistically tested trend for one NASA variable, with chart, plain-language findings, uncertainty, provenance and limitations.

Source of truth: `docs/PRD.md`. Do not contradict it. If something conflicts, stop and say so.

Hard rules:
1. REAL DATA ONLY. Never invent, hardcode or "simulate" scientific values in results the UI shows. Synthetic data is allowed ONLY inside `tests/` for known-answer tests. If a download fails, say so and use a clearly labelled "Cached" real run.
2. Never merge series from different datasets/versions into one series (splice risk).
3. Keep missing values missing. No interpolation.
4. Rate vs accumulation: daily precipitation is a rate (mm/day). Monthly/seasonal totals = sum of valid daily values. Label units everywhere.
5. Trend method: Mann-Kendall + Sen's slope (primary), OLS (cross-check), lag-1 autocorrelation check. Use scipy / a reviewed MK library. Never claim causation. "No significant trend" is a valid result.
6. Frontend sends `region_id` + `boundary_version`, never geometry. The globe does not download NASA data or compute statistics.
7. Secrets (Earthdata credentials, Cesium token) only in `.env` (git-ignored). Commit `.env.example`. Never in frontend source except a URL-restricted Cesium token.
8. Every result carries provenance: dataset id, version, access date, units, run id, code git sha, raw file SHA-256.
9. Stack: Python (xarray, numpy, pandas, scipy, pymannkendall or own tested MK, geopandas/shapely, earthaccess, requests), optional FastAPI, React + Vite + TypeScript + CesiumJS. Static frontend must work on GitHub Pages from precomputed artifacts in `artifacts/`.
10. Git: commits are authored by the human only. NEVER add "Co-authored-by" trailers or any AI/bot attribution. Small commits, format `type(scope): message (FR-xxx)`.
11. Add to README "AI Usage Disclosure" a line for anything Copilot generated. Keep all six README sections: Title/Problem, Team, Solution & Architecture, Live Demo & Screenshots, Install/Setup, AI Usage Disclosure.
12. Each time you add a feature, add or update a test. Keep functions small and typed.
