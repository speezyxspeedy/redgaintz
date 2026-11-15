# TERRASCAN Product Requirements

## A. Product

TERRASCAN is a reproducible trend-detection workflow for one selected NASA Earth-system variable over Vidarbha, India. It is not a causal-attribution or forecasting product.

## B. Users and primary task

A user selects Vidarbha, chooses a verified dataset/variable and period, runs or opens a cached analysis, and inspects the trend, uncertainty, data gaps, provenance, and limitations.

## C. Geographic scope

The region is the union of Akola, Amravati, Buldhana (source spelling may be Buldana), Washim, Yavatmal, Bhandara, Chandrapur, Gadchiroli, Gondia (source spelling may be Gondiya), Nagpur, and Wardha. Source geometry and feature mapping are versioned in the boundary manifest. District selection is display-only for the coarse POWER dataset.

## D. Data integrity

Use real source responses only. Never interpolate missing values or combine versions/products into one series. Failed live requests are surfaced; cached real runs remain labeled with their source access date.

## E. Current supported dataset

NASA POWER Daily regional `PRECTOTCORR`, source MERRA-2, API v2.10.3 at initial verification, units mm/day. Native cells are region-scale (the response's observed grid spacing is 0.5° latitude by 0.625° longitude). It is not suitable for district-level conclusions. Dataset limitations are shown in every result.

## F. Inputs

Analysis requests carry `region_id`, `boundary_version`, `dataset_id`, `variable`, `start`, `end`, and optional aggregation settings. The frontend never submits geometry; the backend resolves the versioned region geometry.

## G. Spatial processing

Clip the provider's native grid-cell centers to the full Vidarbha polygon using `covers`. Compute the spatial mean with cosine(latitude) weights. Record the masking method and cell count. Display geometry is never used for statistics.

## H. Temporal processing

Preserve missing values. Annual precipitation totals are sums of valid daily `mm/day` rates (equivalent to mm for a daily interval); an annual value is missing unless at least 80% of expected daily observations are valid. No interpolation is permitted.

## I. Analysis pipeline

Validate provider dimensions, coordinates, units, fill values, and duplicates; normalize; mask; aggregate; then compute Mann-Kendall, Sen's slope and 95% confidence interval, OLS cross-check, and lag-1 autocorrelation diagnostic. Report insufficient data and autocorrelation concerns.

## J. Result

Each result contains a run ID, region/boundary version, dataset/version, units, annual observations including nulls, trend statistics, data origin, raw SHA-256, source access date, code Git SHA when available, attribution, and limitations.

## K. Static/offline mode

The Vite app loads versioned boundaries and `artifacts/index.json` / result JSON as static assets. It must not fabricate a result when no cached real result exists.

## L. Interactions

Cesium provides India/Maharashtra/Vidarbha camera presets, Vidarbha/district display boundaries, selection by region ID, a verified-dataset selector, loading/error/empty states, result chart with visible gaps, and provenance/limitations disclosure.

## M. JSON contracts

JSON Schemas in `schemas/` are the normative request, dataset, region, run, result, and error contracts. Changes to required fields must update schema examples and tests together.

## N. Non-goals

No causal claims, no district-level POWER conclusions, no simulated or interpolated science output, and no secret in browser code.

## O. Validation thresholds

Default temporal completeness is 0.8. Daily rainfall must be non-negative; implausible extremes are flagged rather than silently removed. Duplicate time/cell observations are rejected.

## P. Provenance

Every result attributes NASA POWER/MERRA-2, the geoBoundaries ODbL 1.0 geometry, processing method, access date, and raw file SHA-256. Code SHA is null when Git metadata is unavailable.

## Q. Accessibility

Controls are keyboard operable and labeled. Charts use text summaries and a color-blind-safe palette; missing observations are represented as gaps.

## R. Errors and cached data

Provider errors are explicit. A cached result is shown only when its schema, region, boundary version, dataset, and provenance match; it is labeled `Cached` with its access date.

## S. Security

Credentials are server-side `.env` values. User-provided IDs and dates are validated against registries. No arbitrary geometry or file path is accepted from the browser.

## T. Deployment

The static frontend is buildable for GitHub Pages with `VITE_BASE_PATH`; the API is optional and separately hosted.

## U. Demo runbook

See `docs/demo.md`. The demo first loads a cached real result, then optionally demonstrates a live NASA POWER run. If the provider is unavailable, the UI stays labeled Cached; if no matching cached run exists, it shows the provider error/empty state.
