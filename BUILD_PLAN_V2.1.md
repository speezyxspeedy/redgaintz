# TERRASCAN Build Plan v2.1 — built on the EXISTING repo (redgaintz)
Written 04:25 IST Sun 15 Nov. Code freeze 14:00 IST (~9.5 h). Supersedes BUILD_PLAN_V2.md. Do NOT rewrite the frontend or pipeline; extend them.

## 1. What exists (keep)
- `frontend/` Vite+React+TS: Cesium globe (`Globe.tsx`), `App.tsx` control panel, `Chart.tsx`, `ChatBot.tsx` + `ragService.ts` (Gemini RAG, runtime key box), boundaries toggles.
- `pipeline/` Python: POWER regional adapter, mask, aggregate, trend (MK + Sen + OLS + lag-1), provenance, tests, FastAPI (`api.py`, optional).
- `artifacts/` 2 saved real runs (rainfall, Vidarbha), `boundaries/` (11 districts), `config/datasets.json` (T2M, RH2M listed verified), schemas, Pages workflow.
## 2. Gaps to close (priority = what the challenge grades)
1. Many variables, not one. 2. User can change variable / season / years and get fresh stats WITHOUT a backend. 3. Plain-language definitions + verdict + 3–4 demos. 4. Charts that read properly (units, axes, trend line, CI). 5. Honest README/AI disclosure, live URL, clean repo.
Root cause of "Unexpected end of JSON input": Run posts to `/api/investigations` (FastAPI on :8000, not running; absent on Pages). Fix = remove that dependency (T3/T5), not "start the server".

## 3. Target architecture
Python (offline, run by us) -> committed JSON series in `artifacts/series/` -> static frontend computes views + trend in the browser with a TS stats module -> charts/table/AI explanation. Stretch: click anywhere -> browser fetches POWER monthly point (CORS verified OK) -> same TS stats.
Series file (one per variable per region), MONTHLY regional means, 1981–2025:
`{schema_version, dataset_id, variable, name, units, aggregation_rule:"sum_of_daily"|"mean", region_id, boundary_version, series:[{year,month,value|null,valid_fraction}], provenance:{raw_sha256, access_date, power_version, data_sources}, limitations:[...]}` (shape only; values come from real runs).

## 4. Workstreams (4 people) and tasks
**WS-A Data (Python)**
- A1 Generalise `pipeline/adapters/power.py` + `run.py` to take any verified POWER parameter; rule per variable: precipitation = sum of daily mm/day (>=80% completeness, as now), temperature/humidity/wind/pressure = mean, solar = mean (kW-hr/m2/day) [confirm units from the JSON].
- A2 New command `python -m pipeline.series --variable T2M --region IN-MH-VID --start 1981 --end 2025` writing the series file + sidecar hashes. Respect rate limits; cache raw.
- A3 Run for 6–8 variables (candidates, VERIFY each in POWER response: PRECTOTCORR, T2M, T2M_MAX, T2M_MIN, RH2M, WS10M, ALLSKY_SFC_SW_DWN, PS). Commit artifacts.
- A4 Sanity checks to put in README: (a) rerun rainfall trend for 1981–2025 and 2001–2025, report both; (b) record which upstream sources POWER used for the final year (MERRA-2 vs GEOS-IT near-real-time) and exclude the last partial/tail months if needed.
- A5 `scripts/make_stats_fixtures.py`: use `pipeline/trend.py` to write `tests/fixtures/stats_expected.json` (several series incl. ties, gaps, AR noise) for the TS tests.
**WS-B Stats + data layer (TypeScript)**
- B1 `frontend/src/lib/stats.ts`: ols (slope, CI, t, p), mannKendall (tie-corrected, Z, p), senSlope (+CI), lag1. Match Python to 1e-6 (add `vitest`, `npm test` runs it).
- B2 `lib/aggregate.ts`: views = annual, season(months), single month, deseasonalised anomaly (subtract per-month climatology); skip years with missing months; return yearsUsed/Skipped.
- B3 `lib/verdict.ts`: templated plain-English verdict (no LLM): direction, rate per decade, total change, % of mean, significant yes/no at 95%, "not proof of cause", autocorrelation warning.
- B4 (stretch) `lib/power.ts`: POWER monthly POINT client with cache; same shape as series files.
**WS-C Frontend (existing UI)**
- C1 `config/variables.json`: id, plain name, one-sentence definition, units, why it matters, caveat, aggregation rule (kids-level wording). 
- C2 Replace the single dataset dropdown with variable cards; keep region select; add View selector (Annual / Season / Single month / Anomaly) and year range; "Analyse" computes in-browser from the series file. Remove/hide the `/api/investigations` path in production.
- C3 `Chart.tsx`: time series + trend line + shaded CI + axis titles with units; annual bars above/below average; seasonal cycle; results table (n, years, slope/decade, CI, p, MK Z/p, Sen, total change, verdict); CSV download.
- C4 Demo buttons (3–4 preset investigations, e.g. Vidarbha monsoon rain, Vidarbha temperature, humidity, solar) that just set the controls — present neutrally, state whatever the data shows.
- C5 Glossary tooltips ("trend", "significant", "p-value", "Sen's slope") in one sentence each.
**WS-D AI, docs, deploy**
- D1 Chat context: pass the computed result JSON + variable card text to the assistant; instruct "explain only given numbers; never compute". Keep key entry at runtime; never put a key in `VITE_*` build env or Actions.
- D2 Repo cleanup: delete `app/`, `components/`, `lib/` (Next.js leftovers), `terrascan_pipeline.egg-info`, `tsconfig.tsbuildinfo`; add to `.gitignore`.
- D3 README: live URL at top, real team table (names, institutions, GitHub usernames, roles), architecture diagram, setup, screenshots, **accurate AI Usage Disclosure** (every tool actually used, which files, what humans verified/tested).
- D4 Enable Pages (Settings -> Pages -> Source: GitHub Actions), confirm deploy, test the live URL incl. a POWER browser fetch from the deployed origin.
- D5 Hourly push rota; check every member has commits under their own account.

## 5. Timeline (IST)
04:30–06:00 A1–A2, B1 start, C1, D2 | 06:00–08:30 A3, B1–B3 done+tested, C2 | 08:30–10:30 C3–C5, D1 | 10:30–12:00 integration, B4 if time, bug bash on live URL | 12:00–13:15 README, screenshots, disclosure, demo rehearsal | 13:15–13:30 FINAL PUSH, tag | 13:30–14:00 buffer only. Nothing risky after 12:00.

## 6. Cut lines (drop in this order if late)
B4 point mode -> C5 tooltips -> seasonal-cycle chart -> extra variables beyond 4 -> demo count. Never cut: multi-variable choice, in-browser stats with tests, verdict + limitations, honest README/disclosure, deployed URL.

## 7. Acceptance checklist
- Choose among >=4 variables and change years/view with no server; numbers match Python fixtures.
- Every number shows units, n years, source, "Cached/Live" label, retrieval date.
- Non-significant results displayed as plainly as significant ones.
- No keys in repo/bundle; no AI/bot commit authors; hourly commits visible.
- Live URL loads on a phone hotspot.

## 8. Ready-to-paste prompts (one per session; attach the zip)
Rules block: "Read the existing files first. Extend, don't rewrite. Do ONE task. No invented data. Show exact file paths and full files. Tell me which commands to run and wait for my pasted output. Don't claim anything was run."
- **T1 (A1–A3):** "Read pipeline/adapters/power.py, run.py, aggregate.py, config/datasets.json. Add `pipeline/series.py` that generates the monthly series file described in section 3 for any verified POWER parameter, reusing the existing regional fetch, mask and weights. Rule per variable: precipitation sum of daily with the existing 80% completeness, others mean. Write raw sidecars + provenance like run.py. Add a pytest for aggregation with a small fixture."
- **T2 (A5):** "Write scripts/make_stats_fixtures.py using pipeline/trend.py to emit tests/fixtures/stats_expected.json for 8 series (positive, negative, null, ties, missing values, AR(1)). Include inputs and every output field."
- **T3 (B1–B3):** "Add vitest. Create frontend/src/lib/stats.ts, aggregate.ts, verdict.ts per the plan. Tests load tests/fixtures/stats_expected.json and must match to 1e-6. Do not modify formulas to pass tests; report mismatches."
- **T4 (C1–C2):** "Read frontend/src/App.tsx and types.ts. Add config/variables.json and replace the single-dataset dropdown with variable cards + view selector + year range, computing in-browser from artifacts/series/*.json. Remove the /api/investigations call from the production path. Keep globe, ChatBot and provenance panel working."
- **T5 (C3):** "Upgrade Chart.tsx (no new chart library unless needed): trend line, 95% band, axis titles with units, annual bars, seasonal cycle, results table, CSV download."
- **T6 (D1):** "In ChatBot/ragService, add a context builder that passes the current result JSON and variable card to Gemini with the instruction to explain only supplied numbers. Don't store keys in code."
Test each step by running it and checking one number by hand in a spreadsheet.
