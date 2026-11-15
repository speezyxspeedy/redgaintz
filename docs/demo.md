# TERRASCAN Demo Runbook

> Code freeze: 02:00 PM Sunday 15 Nov 2026. Run through all steps before submitting.

## Prerequisites

- Node.js 20+ installed; `npm install` done in repo root.
- `npm run dev` running (Vite dev server at `http://localhost:5173`).
- Optional: `python -m uvicorn pipeline.api:app --reload --port 8000` for live-analysis step.

---

## Step 1 — Globe loads immediately at Vidarbha

Open `http://localhost:5173`.  
**Expected:** The Cesium 3D globe centres on Vidarbha within ~1 s (no slow fly-in). Imagery status shows "Natural Earth imagery". The breadcrumb reads **India › Maharashtra › Vidarbha**.

---

## Step 2 — All 11 district names appear on land

Zoom to Vidarbha on the globe.  
**Expected:** 11 labelled point markers appear — one per district — each placed on the land centroid of its polygon (computed dynamically from GeoJSON; no hardcoded coordinates). Verify: Akola, Amravati, Buldhana, Washim, Yavatmal, Bhandara, Chandrapur, Gadchiroli, Gondia, Nagpur, Wardha.

---

## Step 3 — Breadcrumb navigation works

Click **India** in the breadcrumb → globe zooms to India.  
Click **Maharashtra** → globe zooms to Maharashtra.  
Click the **India** preset button → same behaviour.  
**Expected:** Camera transitions complete in ≤ 0.8 s.

---

## Step 4 — District selection highlights and shows display-only note

Open the **Region** dropdown and select any district (e.g. Nagpur).  
**Expected:**
- The selected district polygon turns gold (`#f6c85f`) on the globe; others turn blue.
- A note appears below the dropdown: *"NASA POWER is too coarse for district-level analysis — displayed for navigation only."*
- The **Run live analysis** button is disabled with a tooltip.

---

## Step 5 — Cached result loads with provenance badge

Switch the Region back to **Vidarbha · all 11 districts**. Keep date range 2001–2025, season "Annual total".  
**Expected:**
- Results panel shows a gold **CACHED · `<date>`** badge (top right of results header).
- Findings text states the trend direction, Sen slope, total change, % of mean, and explicitly says "no causation is inferred."
- Stat chips show: MK p-value, Sen slope with units (mm/year), OLS slope, sample count.

---

## Step 6 — Chart shows trend line and orange diamond missing indicators

Inspect the chart in the results panel.  
**Expected:**
- Blue line = observed annual totals (mm). Y-axis label shows units.
- Gold dashed line = Sen's slope trend line; gold shaded band = 95% CI.
- Any missing year → orange diamond marker (`#e69f00`), **not** an X or a red mark.
- Legend shows: "Observed totals", "Sen trend + 95% CI", "Missing".
- Year ticks: first year, every 5-year boundary, last year (for spans > 15 years).
- Table below chart: Year / Total (mm) / Completeness; `<tfoot>` shows complete vs. missing count.

---

## Step 7 — Provenance drawer is complete

Click **Show provenance & limitations**.  
**Expected drawer rows:**
- Dataset (id + version)
- Variable / units
- **Aggregation** ("Annual total (all valid daily values)" or "Monsoon total (JJAS — Jun–Sep)")
- **Data accessed** (human-readable datetime)
- **Data origin** ("Cached (precomputed)" or "Live fetch")
- Run ID
- Raw SHA-256
- Source files count
- Code Git SHA (or note that workspace has no Git metadata)
- Boundary version
- Sen 95% CI (with **mm/year** units)
- **Lag-1 autocorr.** (value; ⚠ flag if above threshold)
- Limitations list (from result JSON)
- Attribution list

---

## Step 8 — Live analysis (if API running)

Ensure `uvicorn pipeline.api:app` is running. Keep region = Vidarbha, date range 2001–2025.  
Click **Run live analysis**.  
**Expected:**
- Button shows spinner + "Fetching NASA data…"
- On success: green **LIVE · `<date>`** badge appears. Provenance drawer automatically opens.
- On failure (NASA POWER unreachable): error note appears below button; existing cached result is not overwritten.

---

## Step 9 — Offline / cached-only mode

Disable Wi-Fi (or stop the API server).  
Reload the page.  
**Expected:**
- Cesium globe loads with the bundled Natural Earth offline basemap.
- District boundaries and labels render from cached GeoJSON.
- The cached 2001–2025 result loads from `artifacts/`; badge reads **CACHED**.
- **Run live analysis** button is disabled or shows an error if clicked.
- No synthetic data is shown at any point.

---

## Step 10 — Keyboard accessibility and no synthetic data

Tab through all interactive controls: breadcrumb buttons, Region/Dataset/Season dropdowns, From/To year inputs, Run live analysis, Boundaries toggle, preset buttons, Reset camera, Show provenance.  
**Expected:** Every focusable element has a visible `2px solid #56b4e9` focus ring.  
Confirm in the browser console: no errors referencing fabricated data.  
Confirm the empty-state message (wrong date range) reads: *"No cached run matches these settings."* — not a simulated result.

---

## Submission checklist

- [ ] All 10 steps above pass visually
- [ ] `npm run typecheck` exits 0
- [ ] `npm run build` exits 0
- [ ] No secrets in Git history (`git log --all --oneline | grep -i password` clean)
- [ ] No "Co-authored-by" AI trailers in any commit
- [ ] README has live GitHub Pages URL and AI Usage Disclosure
- [ ] `artifacts/index.json` lists at least one real run
- [ ] Code freeze respected at 02:00 PM 15 Nov 2026
