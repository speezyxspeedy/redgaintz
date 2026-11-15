# TERRASCAN — GitHub Copilot Playbook (limited paid credits)
Use with the existing repo (frontend/ + pipeline/). Goal: differentiation features, UI/UX, verification. Core features come first (variable choice, in-browser stats with tests, verdicts, deployed URL, honest README).

## 0. Hackathon rules for Copilot (important)
- Use **Copilot Chat / Agent mode inside VS Code (local)**. Do NOT use the cloud "Copilot coding agent" or let it open PRs/commit: bots/AI must never appear as commit authors or contributors.
- YOU run `git add/commit/push` from your own account. No "Co-authored-by: Copilot" lines.
- After every Copilot session add one line to `docs/ai-usage-log.md`: time, tool/model, files touched, what you tested/changed. This becomes the README's AI Usage Disclosure (must be accurate).

## 1. Spend credits wisely (premium-request usage depends on model and mode; check your usage in GitHub Settings -> Copilot [VERIFY plan details])
- One big, precise prompt beats five vague ones. Each prompt below is self-contained with acceptance criteria.
- Use the premium model only for P1, P4, P5 (multi-file work). Use the default/included model for P2, P3, small fixes, README text.
- Always end a prompt with the verify step; don't spend a second prompt to ask "did it work?"
- Workflow: paste prompt -> let it finish -> run `npm run build` and `npm test` yourself -> open the app and click through -> commit. If broken, paste the exact error back (1 follow-up max), else `git restore .` and rephrase.
- Reserve ~2 prompts for the final QA (P6). Stop adding features 2 hours before freeze.

## 2. Replace `.github/copilot-instructions.md` with this (applies automatically, saves prompt tokens)
```
Project: TERRASCAN, a NASA Space Apps 2026 "Earth System Trend Detective" tool. Audience: high-school/college users and public.
Rules:
- Extend the existing code. Do not rewrite or restyle wholesale. Keep Cesium globe, ChatBot, provenance panel.
- Never invent data or numbers. All values come from real NASA POWER responses or saved artifacts. No placeholder values shown to users.
- All statistics are deterministic code (OLS, Mann-Kendall with tie correction, Sen's slope, lag-1). LLM text may only explain numbers already computed.
- Every displayed result shows units, number of years used, data source, Cached/Live label, and limitations. Non-significant results are shown as plainly as significant ones. Never imply causation.
- No secrets in code or VITE_* env. No new heavy dependencies without asking. Prefer small typed modules in frontend/src/lib with vitest tests.
- Do not commit, push, create branches or PRs. Do not add co-author lines.
- After changes: run `npm run build` and `npm test` (and pytest if Python changed) and report real output. If you cannot run something, say so.
```

## 3. Prompts (run in this order)

### P0 — Audit (read-only, cheap model)
```
Read the repo. Do not change files. Run npm run build and npm test (and pytest if available). Report: (1) what features work end to end, (2) what is broken or fake/placeholder, (3) where stats are computed (Python vs TS) and whether TS tests exist, (4) whether per-grid-cell series exist in pipeline before spatial averaging (file/function names), (5) any secrets or VITE_ keys, (6) Pages base-path issues. Output a short checklist with file paths.
```

### P1 — Trend Scanner "What's changing here?" (premium)
```
Add a Trend Scanner. Behaviour: user clicks a location on the globe (or enters lat/lon) and presses "Scan this place". The app makes ONE call to NASA POWER monthly POINT API (https://power.larc.nasa.gov/api/temporal/monthly/point, community=AG, format=JSON, start=1981, end=<last complete year>) for all variables in config/variables.json (max 20 parameters per call; split into batches if more). Do not use the 13th "annual" key; treat -999 as missing.
Implement in frontend/src/lib/scanner.ts:
- Build annual series per variable: precipitation = sum over months of (mm/day * days in month), others = mean of 12 months; skip years with any missing month; record yearsUsed.
- For each variable compute Mann-Kendall (tie-corrected, two-sided p), Sen's slope per decade with CI, OLS slope + p (reuse lib/stats.ts; if missing, create with tests).
- Effect size comparable across units: effectSD = (senSlopePerYear*(n-1)) / sd(annual values after removing the OLS trend). Label it "size of change vs normal year-to-year swings".
- Multiple-testing correction: Benjamini-Hochberg across all scanned variables at q=0.05: adjP_i = min_{j>=i}(p_j*m/j) over ascending p, capped at 1. Mark "significant after correction".
- Ranking: significant-after-correction first, then by adjP, then |effectSD|.
UI (new panel "What's changing here?"): ranked table with plain variable name, direction arrow, rate per decade with units, total change, effectSD in words (small/moderate/large), raw p, adjusted p, years used. A one-line explanation of why we correct for false alarms. Rows are clickable and load that variable into the existing chart. Show data-origin label "Live (NASA POWER, retrieved <date>)", cache responses in localStorage. States: loading, error (readable message, no JSON parse crashes: check response.ok and content-type), empty, insufficient data.
Tests (vitest): BH known answers: p=[0.01,0.02,0.03,0.04,0.05] -> all adjusted 0.05; p=[0.001,0.2,0.04] -> adjusted [0.003,0.06,0.2] in original order. Annual aggregation test with a missing month and a leap/short month case.
Do not use any invented data. Run build and tests and report output.
```

### P2 — Robustness explorer (default model)
```
Add a "Is this trend robust?" view for the currently selected annual series. Compute, for every start year s and end year e with at least 10 years, the Sen slope and Mann-Kendall p (reuse lib/stats.ts). Render a heatmap (SVG or canvas, no new library): x=start year, y=end year, colour = slope sign/size on a colour-blind-safe diverging scale, non-significant cells (p>=0.05) drawn faded. Clicking a cell sets the chart's year range to that window. Show a plain sentence: "In X% of the Y windows we tested, the trend was the same direction and significant." Add a legend with units and a note that many windows are overlapping, so this is a sensitivity view, not independent tests. Add a unit test for the window enumeration count. Run build/tests and report output.
```

### P3 — "AI proposes, statistics disposes" (default model)
```
In ChatBot/ragService add a "Find candidate variables" flow. User text (e.g. "I live near a big coal plant", "rainforest", "desert city") is sent to Gemini with a prompt that returns ONLY JSON {"variables":[ids from config/variables.json], "reason": "..."}; validate the JSON against the catalogue and drop unknown IDs. Then run the Trend Scanner on only those variables (if a place is selected) and show results. Afterwards pass the computed result JSON to Gemini with the instruction to explain only the supplied numbers in simple words, no new numbers, no causation claims. The API key is entered at runtime by the user (existing key box); never store it in code or VITE_ env; if no key, show the catalogue picker instead. Label AI text "AI-generated explanation". Handle malformed JSON gracefully. Run build/tests.
```

### P4 — "Where" opposite-trend map (premium; only if P0 says per-cell series are available and >=3 h remain)
```
Using per-grid-cell annual series for the selected variable (add to the pipeline artifact output if needed; keep existing artifacts working), compute per-cell Sen slope and MK p in the browser. Show on the Cesium globe: one rectangle per cell, red = increasing, blue = decreasing (colour-blind-safe), extruded height proportional to |slope| scaled consistently, faded when p>=0.05. Add a legend with units and a summary line: "N cells rising, M falling, K not significant" and highlight if both significant directions exist ("opposite trends within this region"). Clicking a cell shows its series. State clearly that cells are ~50 km model grid cells. No invented cells or values. Run build/tests.
```

### P5 — UI/UX pass for non-experts (premium)
```
Improve UX without redesigning everything. Make a 3-step flow "1 What? 2 Where? 3 When?" then results. Requirements: plain-English labels and one-sentence help text for every control; glossary tooltips for trend, significant, p-value, Sen's slope, seasonal cycle; results shown as a short verdict first (e.g. "Rising about X per decade... statistically significant / not significant") with details collapsed below; every chart has title, axis labels with units, legend; consistent colour-blind-safe palette (not red/green only); visible Cached/Live badge; loading skeletons; friendly error states; keyboard focus styles and sufficient contrast; responsive layout that works on a laptop projector and a phone. Add 3-4 demo buttons that only set the controls (no fabricated text). Do not add new UI libraries. Do not remove existing features. Run build and report; list changed files.
```

### P6 — Final QA (use two prompts max)
```
QA pass. 1) Run build, tests, and (if present) lint/typecheck; fix only real failures. 2) Verify vite base path and GitHub Pages workflow produce a working site at the repo URL (assets load, Cesium assets load, no absolute /paths breaking). 3) Search the repo and built dist for secrets or API keys. 4) Check every fetch handles non-OK and non-JSON responses without throwing "Unexpected end of JSON input". 5) Confirm no placeholder/mock numbers are displayed. 6) Confirm every result view shows units, n years, source, Cached/Live. Report findings with file paths and fix safe issues.
```

### P7 — README help (default model)
```
Draft README.md with six sections: 1 Title and problem statement (Earth System Trend Detective), 2 Team (leave TODO placeholders for names/institutions/usernames/roles), 3 Solution overview and architecture (diagram in Mermaid, only real components), 4 Live demo and screenshots (TODO placeholders), 5 Installation and setup (commands from package.json/pyproject), 6 AI usage disclosure (use docs/ai-usage-log.md; leave TODO where unknown). Do not invent features, results or numbers. Put the live URL placeholder at the top.
```

## 4. Human verification (you, not Copilot)
1. Pick one variable; export its annual series; compute the OLS slope in Google Sheets (`=SLOPE`) and compare to the app. Must match.
2. Check one Sen slope or MK result against `pipeline/trend.py` output for the same series.
3. Confirm the scanner's numbers don't change when you scan twice (cache vs live).
4. Open the deployed URL on a phone hotspot; try Wi-Fi off with saved data.
5. Check Contributors on GitHub shows all four members; last push < 1 h ago.
6. Read the verdict text aloud: would a high-school student understand it? Does it avoid saying "caused by"?

## 5. If credits run out
Paste the same prompt into a free model (give it the files it names), or send me the prompt plus the file and I will help. Never skip the build/test check.
