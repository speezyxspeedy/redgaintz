import { AlertTriangle, ArrowDownToLine, CalendarRange, CheckCircle2, Compass, Download, Info, Layers, MapPin, Play, RefreshCw, Scale, Sparkles, Square, TrendingDown, TrendingUp } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import Lineage from "../Lineage";
import { ProbabilityPanel } from "../AdvancedCharts";
import { BarsChart, SeasonalChart, Sparkline, TrendChart } from "../charts";
import { Term, VarIcon, replaceParams } from "../components";
import { FIRST_YEAR, LAST_COMPLETE_YEAR, useSeries } from "../data";
import { analyse, paramToView, seasonalCycle, toCsv, viewToParam, type Analysis } from "../lib/analysis";
import { aggregate, MONTH_NAMES, SEASONS } from "../lib/aggregate";
import type { ViewSpec } from "../lib/sciTypes";
import type { MonthlySeries } from "../lib/sciTypes";
import { fmt, fmtP } from "../lib/verdict";
import { VARIABLES, getVariable, type VariableCard } from "../lib/variables";
import { scanTrends, type ScannerResult } from "../lib/scanner";
import { enumerateRobustnessWindows, robustnessSummary, type RobustnessWindow } from "../lib/robustness";
import { cellExtent, fetchRegionalCellTrends, type RegionalTrendResult } from "../lib/regional";
import { ALL_PLACES, DEMOS, DISTRICT_PLACES, VIDARBHA_PLACE, WORLD_PLACES, accentFor, customPlace, findPlace, type Demo, type Place } from "../theme";
import type { AnalysisResult } from "../types";
import { getCopy, type Language } from "../i18n";

const Globe = lazy(() => import("../Globe"));

type ChartTab = "trend" | "bars" | "cycle" | "prob";

interface Props {
  language?: Language;
  params: URLSearchParams;
  onResult: (r: AnalysisResult | null) => void;
}

function placeFromParams(p: URLSearchParams): Place {
  const id = p.get("p") ?? "IN-MH-VID-NAG";
  if (id === "custom") {
    const lat = Number(p.get("lat"));
    const lon = Number(p.get("lon"));
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return customPlace(lat, lon);
  }

  return findPlace(id) ?? findPlace("IN-MH-VID-NAG")!;
}

function coordinatesInGeometry(geometry: { coordinates?: unknown }): number[][] {
  const points: number[][] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      points.push([value[0], value[1]]);
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
  };
  walk(geometry.coordinates);
  return points;
}

async function boundsForRegion(regionId: string): Promise<{ west: number; south: number; east: number; north: number }> {
  const response = await fetch(`${import.meta.env.BASE_URL}boundaries/IN-MH-VID.display.geojson`);
  if (!response.ok) throw new Error("The selected region boundary could not be loaded.");
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("json")) throw new Error("The selected region boundary was not returned as JSON.");
  let json: { features?: Array<{ properties?: { region_id?: string }; geometry?: { coordinates?: unknown } }> };
  try {
    json = await response.json() as { features?: Array<{ properties?: { region_id?: string }; geometry?: { coordinates?: unknown } }> };
  } catch {
    throw new Error("The selected region boundary returned invalid JSON.");
  }
  const feature = json.features?.find((item) => item.properties?.region_id === regionId) ?? json.features?.find((item) => item.properties?.region_id === "IN-MH-VID");
  if (!feature?.geometry) throw new Error("No boundary is available for the selected region.");
  const points = coordinatesInGeometry(feature.geometry);
  if (!points.length) throw new Error("The selected region boundary has no coordinates.");
  return {
    west: Math.min(...points.map((point) => point[0])),
    south: Math.min(...points.map((point) => point[1])),
    east: Math.max(...points.map((point) => point[0])),
    north: Math.max(...points.map((point) => point[1])),
  };
}

function toLegacy(a: Analysis, card: VariableCard, place: Place, meta: ReturnType<typeof useSeries>["meta"]): AnalysisResult | null {
  if (!a.stats || !a.verdict) return null;
  const s = a.stats;
  return {
    run_id: "in-browser",
    region_id: place.regionId ?? place.id,
    boundary_version: "n/a (point value)",
    dataset_id: `NASA-POWER-${card.id}`,
    dataset_version: meta?.api_version ?? "unknown",
    variable: `${card.short_name} (${card.id}), ${a.agg.label}`,
    units: a.agg.units,
    aggregation: a.agg.view.kind === "season" && a.agg.view.seasonId === "monsoon" ? "jjas_total" : "annual_total",
    observations: a.agg.years.map((y, i) => ({ time: y, value: a.agg.values[i], valid_fraction: a.agg.values[i] === null ? 0 : 1, cell_count: 1 })),
    trend: {
      status: "ok",
      direction: s.direction,
      p_value: s.p_value,
      significant: s.significant,
      sen_slope: s.sen_slope,
      sen_slope_ci95: s.sen_slope_ci95,
      ols_slope: s.ols_slope,
      lag1_autocorrelation: s.lag1_autocorrelation,
      lag1_autocorrelation_threshold: s.lag1_autocorrelation_threshold,
      lag1_autocorrelation_flag: s.lag1_autocorrelation_flag,
      total_change: s.total_change,
      percent_change_of_mean: s.percent_change_of_mean,
      sample_count: s.sample_count,
      interpretation: a.verdict.plain,
    },
    findings: `${a.verdict.plain} Variable: ${card.short_name}. Place: ${place.label} (${place.lat}, ${place.lon}). Definition: ${card.definition} Caveat: ${card.caveat}`,
    provenance: {
      run_id: "in-browser",
      dataset_id: `NASA-POWER-${card.id}`,
      dataset_version: meta?.api_version ?? "unknown",
      access_date: meta?.retrieved_utc || "snapshot",
      data_origin: meta?.origin ?? "cached",
      raw_sha256: "0".repeat(64),
      raw_sha256_algorithm: "n/a",
      raw_sources: [],
      code_git_sha: null,
      request_params: {},
    },
    limitations: [card.caveat],
    attribution: ["NASA POWER (MERRA-2 based)"],
  };
}

export default function Investigate({ language = "en", params, onResult }: Props) {
  const copy = getCopy(language);
  const [varId, setVarId] = useState(() => (VARIABLES.some((v) => v.id === params.get("v")) ? params.get("v")! : "PRECTOTCORR"));
  const [place, setPlace] = useState<Place>(() => placeFromParams(params));
  const [view, setView] = useState<ViewSpec>(() => (params.get("view") ? paramToView(params.get("view")) : getVariable("PRECTOTCORR").suggested_view));
  const [start, setStart] = useState(() => clampYear(Number(params.get("s")) || FIRST_YEAR));
  const [end, setEnd] = useState(() => clampYear(Number(params.get("e")) || LAST_COMPLETE_YEAR));
  const [tab, setTab] = useState<ChartTab>("trend");
  const [retry, setRetry] = useState(0);
  const [tour, setTour] = useState<{ demo: Demo; step: number } | null>(() => {
    const d = DEMOS.find((x) => x.id === params.get("demo"));
    return d ? { demo: d, step: 0 } : null;
  });
  const [customLat, setCustomLat] = useState(place.kind === "custom" ? String(place.lat) : "");
  const [customLon, setCustomLon] = useState(place.kind === "custom" ? String(place.lon) : "");
  const [placeGroup, setPlaceGroup] = useState<"vidarbha" | "world" | "custom">(() => (place.kind === "world" ? "world" : place.kind === "custom" ? "custom" : "vidarbha"));
  const [scanner, setScanner] = useState<{ status: "idle" | "loading" | "ready" | "error"; result: ScannerResult | null; error: string | null }>({ status: "idle", result: null, error: null });
  const [cellMap, setCellMap] = useState<{ status: "idle" | "loading" | "ready" | "error"; result: RegionalTrendResult | null; error: string | null }>({ status: "idle", result: null, error: null });
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const data = useSeries(place);
  void retry;
  const card = getVariable(varId);
  const accent = accentFor(varId);
  const series = data.series[varId];
  const rangeOk = Number.isInteger(start) && Number.isInteger(end) && start >= FIRST_YEAR && end <= LAST_COMPLETE_YEAR && end - start >= 4;

  const analysis = useMemo<Analysis | null>(() => {
    if (!series || !rangeOk) return null;
    try {
      return analyse(series, card, view, start, end);
    } catch {
      return null;
    }
  }, [series, card, view, start, end, rangeOk]);

  const cycle = useMemo(() => (series && rangeOk ? seasonalCycle(series, start, end) : null), [series, start, end, rangeOk]);
  const robustness = useMemo(() => {
    if (!series || !rangeOk) return null;
    const annual = aggregateAnnual(series, start, end);
    const windows = enumerateRobustnessWindows(annual.years, annual.values);
    return {
      units: annual.units,
      windows,
      reference: windows.find((window) => window.startYear === start && window.endYear === end)?.stats ?? null,
    };
  }, [series, start, end, rangeOk]);

  // Little preview for each variable card: annual trend over the chosen years.
  const previews = useMemo(() => {
    const out: Record<string, Analysis | null> = {};
    if (!rangeOk) return out;
    for (const v of VARIABLES) {
      const s = data.series[v.id];
      if (!s) continue;
      try {
        out[v.id] = analyse(s, v, { kind: "annual" }, start, end);
      } catch {
        out[v.id] = null;
      }
    }
    return out;
  }, [data.series, start, end, rangeOk]);

  useEffect(() => {
    onResult(analysis && data.meta ? toLegacy(analysis, card, place, data.meta) : null);
    return () => onResult(null);
  }, [analysis, card, place, data.meta, onResult]);

  useEffect(() => {
    replaceParams("/investigate", {
      v: varId,
      p: place.id,
      lat: place.kind === "custom" ? place.lat : undefined,
      lon: place.kind === "custom" ? place.lon : undefined,
      view: viewToParam(view),
      s: start,
      e: end,
    });
  }, [varId, place, view, start, end]);

  useEffect(() => {
    setCellMap({ status: "idle", result: null, error: null });
    setSelectedCellId(null);
  }, [varId, place.id, start, end]);

  // Guided demo: sets the controls one step at a time, nothing else.
  useEffect(() => {
    if (!tour) return;
    const { demo, step } = tour;
    if (step === 0) setVarId(demo.variable);
    if (step === 1) selectPlace(findPlace(demo.placeId)!);
    if (step === 2) {
      setView(demo.view);
      setStart(demo.start);
      setEnd(demo.end);
    }
    if (step >= 4) return;
    const t = window.setTimeout(() => setTour({ demo, step: step + 1 }), step === 3 ? 6500 : 2400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  function selectPlace(p: Place) {
    setPlace(p);
    setPlaceGroup(p.kind === "world" ? "world" : p.kind === "custom" ? "custom" : "vidarbha");
  }

  function pickVariable(id: string) {
    setTour(null);
    setVarId(id);
    setView(getVariable(id).suggested_view);
  }

  async function scanPlace() {
    setScanner({ status: "loading", result: null, error: null });
    try {
      const result = await scanTrends({ lat: place.lat, lon: place.lon, startYear: FIRST_YEAR, endYear: LAST_COMPLETE_YEAR });
      setScanner({ status: "ready", result, error: null });
    } catch (error) {
      setScanner({ status: "error", result: null, error: error instanceof Error ? error.message : "Could not scan this place." });
    }

  }

  async function mapCellTrends() {
    if (!place.regionId || place.kind === "world" || place.kind === "custom") {
      setCellMap({ status: "error", result: null, error: "Cell trends require a Vidarbha boundary selection." });
      return;
    }
    setCellMap({ status: "loading", result: null, error: null });
    try {
      const bounds = await boundsForRegion(place.regionId);
      const result = await fetchRegionalCellTrends({ variableId: card.id, startYear: start, endYear: end, bounds });
      setCellMap({ status: "ready", result, error: null });
    } catch (error) {
      setCellMap({ status: "error", result: null, error: error instanceof Error ? error.message : "Could not load regional cell trends." });
    }
  }

  const cellOverlays = useMemo(() => {
    if (!cellMap.result) return [];
    const extent = cellExtent(cellMap.result.cells);
    const maxSlope = Math.max(...cellMap.result.cells.map((cell) => Math.abs(cell.stats?.sen_slope ?? 0)), 1e-12);
    return cellMap.result.cells.map((cell) => {
      const slope = cell.stats?.sen_slope ?? 0;
      const significant = Boolean(cell.stats && cell.stats.p_value < 0.05);
      const base = slope >= 0 ? [213, 94, 0] : [0, 114, 178];
      const alpha = significant ? 0.72 : 0.22;
      return {
        id: `trend-${cell.id}`,
        cellId: cell.id,
        latitude: cell.latitude,
        longitude: cell.longitude,
        halfWidth: extent.halfWidth,
        halfHeight: extent.halfHeight,
        height: Math.abs(slope) / maxSlope * 30_000,
        color: `rgba(${base.join(",")},${alpha})`,
      };
    });
  }, [cellMap.result]);

  const tourCaptions = tour
    ? [
        `1 · Pick what to investigate: ${getVariable(tour.demo.variable).short_name}`,
        `2 · Choose where: ${findPlace(tour.demo.placeId)?.label}`,
        `3 · Choose how to look at it, and the years`,
        "4 · Read the verdict, then the chart and the numbers",
        tour.demo.look,
      ]
    : [];

  const viewTitle = analysis?.agg.label ?? "";
  const chartTitle = `${card.short_name} at ${place.label}: ${viewTitle}`;
  const missingMsg = data.missing[varId];

  return (
    <div className="inv">
      {tour && (
        <div className="tour-bar" role="status" aria-live="polite">
          <Sparkles size={18} aria-hidden="true" />
          <div>
            <strong>Demo: {tour.demo.title}</strong>
            <span>{tourCaptions[tour.step]}</span>
          </div>
          <button className="btn btn--ghost" onClick={() => setTour(null)}>
            <Square size={14} aria-hidden="true" /> Stop
          </button>
        </div>
      )}
      <nav className="step-rail" aria-label="Investigation steps">
        <a href="#step-what"><span>1</span><strong>{copy.flow.what}</strong><small>{copy.flow.chooseVariable}</small></a>
        <a href="#step-where"><span>2</span><strong>{copy.flow.where}</strong><small>{copy.flow.choosePlace}</small></a>
        <a href="#step-when"><span>3</span><strong>{copy.flow.when}</strong><small>{copy.flow.chooseYears}</small></a>
        <a href="#results"><span>4</span><strong>{copy.flow.results}</strong><small>{copy.flow.readEvidence}</small></a>
      </nav>

      <aside className="inv-controls" aria-label="Investigation controls">
        <div className="demo-strip">
          <span className="eyebrow">Watch a demo</span>
          <div className="demo-chips">
            {DEMOS.map((d) => (
              <button key={d.id} className="chip" onClick={() => setTour({ demo: d, step: 0 })} title={d.question}>
                <Play size={12} aria-hidden="true" /> {d.title}
              </button>
            ))}
          </div>
        </div>

        <section className="step" id="step-what" aria-labelledby="s1">
          <header>
            <span className="step-n">1</span>
            <div>
              <h2 id="s1">{copy.flow.what} do you want to investigate?</h2>
              <p>Pick a measured quantity. Each card has a plain-language definition and units.</p>
            </div>
          </header>
          <div className="var-grid" role="radiogroup" aria-label="Variable">
            {VARIABLES.map((v, i) => {
              const ac = accentFor(v.id);
              const pv = previews[v.id];
              const unavailable = data.status === "ready" && !data.series[v.id];
              const sel = v.id === varId;
              return (
                <button
                  key={v.id}
                  role="radio"
                  aria-checked={sel}
                  disabled={unavailable}
                  className={`var-card ${sel ? "is-selected" : ""}`}
                  title={`${v.short_name}: ${v.definition}`}
                  style={{ ["--a" as string]: ac.a, ["--b" as string]: ac.b, animationDelay: `${i * 40}ms` }}
                  onClick={() => pickVariable(v.id)}
                >
                  <span className="var-icon"><VarIcon id={v.id} /></span>
                  <span className="var-name">{v.short_name}</span>
                  {pv?.stats ? (
                    <span className={`var-trend ${pv.stats.significant ? "is-sig" : ""}`}>
                      {pv.stats.direction === "increasing" ? <TrendingUp size={13} aria-hidden="true" /> : pv.stats.direction === "decreasing" ? <TrendingDown size={13} aria-hidden="true" /> : <Scale size={13} aria-hidden="true" />}
                      {pv.stats.significant ? (pv.stats.direction === "increasing" ? "Rising" : "Falling") : "No clear trend"}
                    </span>
                  ) : (
                    <span className="var-trend">{unavailable ? "Unavailable" : data.status === "loading" ? "Loading…" : v.verified === false ? "Units checked on fetch" : "—"}</span>
                  )}
                  {pv && <Sparkline values={pv.agg.values} color={ac.a} width={150} height={32} />}
                </button>
              );
            })}
          </div>
          <p className="var-def" style={{ ["--a" as string]: accent.a }}>
            <strong>{card.short_name}.</strong> {card.definition}
            <span className="var-why">{card.why_it_matters}</span>
          </p>
        </section>

        <section className="step" id="step-where" aria-labelledby="s2">
          <header>
            <span className="step-n">2</span>
            <div>
              <h2 id="s2">{copy.flow.where}</h2>
              <p>One NASA grid cell (about 50 km wide) centred on the place.</p>
            </div>
          </header>
          <div className="seg" role="tablist" aria-label="Kind of place">
            {(["vidarbha", "world", "custom"] as const).map((g) => (
              <button key={g} role="tab" aria-selected={placeGroup === g} className={placeGroup === g ? "is-on" : ""} onClick={() => setPlaceGroup(g)}>
                {g === "vidarbha" ? "Vidarbha" : g === "world" ? "Around the world" : "Any point"}
              </button>
            ))}
          </div>
          {placeGroup === "vidarbha" && (
            <div className="place-chips">
              {[VIDARBHA_PLACE, ...DISTRICT_PLACES].map((p) => (
                <button key={p.id} className={`chip ${place.id === p.id ? "is-on" : ""}`} onClick={() => selectPlace(p)} title={p.sub}>{p.label}</button>
              ))}
            </div>
          )}
          {placeGroup === "world" && (
            <div className="place-chips">
              {WORLD_PLACES.map((p) => (
                <button key={p.id} className={`chip ${place.id === p.id ? "is-on" : ""}`} onClick={() => selectPlace(p)} title={p.sub}>{p.label}</button>
              ))}
            </div>
          )}
          {placeGroup === "custom" && (
            <form
              className="latlon"
              onSubmit={(e) => {
                e.preventDefault();
                const la = Number(customLat);
                const lo = Number(customLon);
                if (Number.isFinite(la) && Number.isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) selectPlace(customPlace(la, lo));
              }}
            >
              <label>Latitude<input inputMode="decimal" value={customLat} onChange={(e) => setCustomLat(e.target.value)} placeholder="e.g. 21.15" /></label>
              <label>Longitude<input inputMode="decimal" value={customLon} onChange={(e) => setCustomLon(e.target.value)} placeholder="e.g. 79.09" /></label>
              <button className="btn" type="submit"><MapPin size={14} aria-hidden="true" /> Go</button>
            </form>
          )}
        </section>

        <section className="step" id="step-when" aria-labelledby="s3">
          <header>
            <span className="step-n">3</span>
            <div>
              <h2 id="s3">{copy.flow.when}</h2>
              <p>Choose a time window and whether to show the <Term id="seasonal-cycle">seasonal cycle</Term>.</p>
            </div>
          </header>
          <div className="seg seg--wrap" role="tablist" aria-label="View">
            {(["annual", "season", "month", "anomaly"] as const).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={view.kind === k}
                className={view.kind === k ? "is-on" : ""}
                title={k === "annual" ? "Aggregate all valid months into one value per year." : k === "season" ? "Compare the selected season across years." : k === "month" ? "Compare one calendar month across years." : "Remove the usual seasonal cycle before testing the trend."}
                onClick={() => setView(k === "annual" ? { kind: "annual" } : k === "anomaly" ? { kind: "anomaly" } : k === "season" ? { kind: "season", seasonId: "monsoon" } : { kind: "month", month: 7 })}
              >
                {k === "annual" ? "Whole year" : k === "season" ? "Season" : k === "month" ? "One month" : "Anomaly"}
              </button>
            ))}
          </div>
          {view.kind === "season" && (
            <div className="place-chips">
              {SEASONS.map((s) => (
                <button key={s.id} className={`chip ${view.seasonId === s.id ? "is-on" : ""}`} onClick={() => setView({ kind: "season", seasonId: s.id })}>{s.label}</button>
              ))}
            </div>
          )}
          {view.kind === "month" && (
            <div className="place-chips place-chips--months">
              {MONTH_NAMES.map((m, i) => (
                <button key={m} className={`chip ${view.month === i + 1 ? "is-on" : ""}`} onClick={() => setView({ kind: "month", month: i + 1 })}>{m}</button>
              ))}
            </div>
          )}
          {view.kind === "anomaly" && (
            <p className="hint"><Term id="anomaly">Anomaly</Term> view subtracts the usual value for each calendar month, so slow changes stand out.</p>
          )}
          <div className="years">
            <CalendarRange size={16} aria-hidden="true" />
            <label>From<input type="number" min={FIRST_YEAR} max={LAST_COMPLETE_YEAR} value={start} onChange={(e) => setStart(Number(e.target.value))} aria-invalid={!rangeOk} /></label>
            <label>To<input type="number" min={FIRST_YEAR} max={LAST_COMPLETE_YEAR} value={end} onChange={(e) => setEnd(Number(e.target.value))} aria-invalid={!rangeOk} /></label>
            <button className="btn btn--ghost" onClick={() => { setStart(FIRST_YEAR); setEnd(LAST_COMPLETE_YEAR); }}>All years</button>
          </div>
          {!rangeOk && <p className="field-error" role="alert">Choose years between {FIRST_YEAR} and {LAST_COMPLETE_YEAR}, at least five years apart.</p>}
          <a className="btn btn--primary jump" href="#results" onClick={(e) => { e.preventDefault(); document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }); }}>
            <ArrowDownToLine size={15} aria-hidden="true" /> See the results
          </a>
        </section>
      </aside>

      <section className="inv-results" id="results" aria-live="polite" style={{ ["--a" as string]: accent.a, ["--b" as string]: accent.b }}>
        <ResultsHeader card={card} place={place} data={data} />
        <section className="map-workspace card" aria-labelledby="map-workspace-title">
          <div className="card-head">
            <div>
              <span className="eyebrow">Live map workspace</span>
              <h2 id="map-workspace-title">Where is this signal?</h2>
              <p className="hint">Select a place in the left panel, then use the map to inspect its NASA grid cell.</p>
            </div>
            <span className="map-location"><Compass size={14} aria-hidden="true" /> {place.label}</span>
          </div>
          <div className="globe-card">
            <Suspense fallback={<div className="globe-loading">Loading 3D globe…</div>}>
              <Globe
                selectedRegionId={place.regionId ?? "IN-MH-VID"}
                onSelectRegion={(id) => {
                  const p = ALL_PLACES.find((x) => x.regionId === id);
                  if (p) selectPlace(p);
                }}
                showBoundaries
                showWorldBoundaries
                showIndiaStates
                preset={place.kind === "world" || place.kind === "custom" ? "india" : "vidarbha"}
                marker={{ lat: place.lat, lon: place.lon, label: place.label }}
                cellOverlays={cellOverlays}
                onSelectCell={setSelectedCellId}
                onImageryStatus={() => undefined}
              />
            </Suspense>
            <span className="globe-cap"><Compass size={12} aria-hidden="true" /> {place.label} · {place.lat.toFixed(2)}°, {place.lon.toFixed(2)}°</span>
          </div>
          <div className="cell-map-controls">
            <button className="btn btn--ghost" onClick={() => void mapCellTrends()} disabled={cellMap.status === "loading" || place.kind === "world" || place.kind === "custom"}>
              {cellMap.status === "loading" ? "Mapping cell trends…" : "Map regional cell trends"}
            </button>
            <span className="hint">Uses live NASA POWER daily regional grid cells for the selected variable and years.</span>
          </div>
        </section>
        {data.status === "loading" && <Skeleton />}
        {data.status === "error" && (
          <div className="notice notice--error" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>Could not load NASA POWER data for this place.</strong>
              <p>{data.error}</p>
              <button className="btn" onClick={() => setRetry((n) => n + 1)}><RefreshCw size={14} aria-hidden="true" /> Try again</button>
              <p className="hint">Nagpur has a saved snapshot of real NASA POWER data that works without a connection. Other places need the network.</p>
            </div>
          </div>
        )}
        {data.status === "ready" && missingMsg && !series && (
          <div className="notice"><Info size={20} aria-hidden="true" /><div><strong>{card.short_name} is not available right now.</strong><p>{missingMsg}</p></div></div>
        )}
        {data.status === "ready" && series && analysis && (
          <>
            <VerdictCard analysis={analysis} card={card} />
            <div className="tiles">
              <Tile label="Typical change" value={analysis.stats ? analysis.verdict!.rate_per_decade.replace(" per decade", "") : "—"} sub="per decade (Sen's slope)" />
              <Tile label="Total change" value={analysis.stats ? `${fmt(analysis.stats.total_change, true)} ${analysis.agg.units}` : "—"} sub={analysis.stats?.percent_change_of_mean != null && view.kind !== "anomaly" ? `${fmt(analysis.stats.percent_change_of_mean, true)}% of the average` : `over ${analysis.agg.yearsUsed.length} years`} />
              <Tile label="p-value" value={analysis.stats ? fmtP(analysis.stats.p_value) : "—"} sub={analysis.stats ? (analysis.stats.significant ? "below 0.05: significant" : "not below 0.05: not significant") : ""} />
              <Tile label="Years used" value={`${analysis.agg.yearsUsed.length}`} sub={`${analysis.agg.yearsUsed[0] ?? start}–${analysis.agg.yearsUsed[analysis.agg.yearsUsed.length - 1] ?? end}`} />
            </div>

            <div className="card chart-card">
              <div className="tabs" role="tablist" aria-label="Chart type">
                {([["trend", "Trend line"], ["bars", "Above / below average"], ["cycle", "Seasonal cycle"], ["prob", "Probability and change"]] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{l}</button>
                ))}
              </div>
              {tab === "trend" && <TrendChart analysis={analysis} accent={accent} title={chartTitle} />}
              {tab === "bars" && <BarsChart analysis={analysis} title={chartTitle} />}
              {tab === "prob" && <ProbabilityPanel analysis={analysis} />}
              {tab === "cycle" && cycle && (
                <SeasonalChart months={cycle.months} units={cycle.units} view={view} accent={accent} title={`${card.short_name} at ${place.label}: typical year`} quantity={series.rule === "sum_of_daily_rate" ? "Monthly total" : "Monthly average"} />
              )}
              <p className="chart-source">Source: NASA POWER (MERRA-2), {data.meta?.retrieved_utc ? `retrieved ${data.meta.retrieved_utc.slice(0, 10)}` : "saved snapshot"}. Analysis: TERRASCAN.</p>
              <p className="method-note"><Info size={14} aria-hidden="true" /> {analysis.agg.method_note}</p>
            </div>

            <ResultsTable analysis={analysis} card={card} place={place} />
            {data.meta && <Lineage card={card} meta={data.meta} analysis={analysis} place={place} offline={data.offlineSnapshot} />}
            <Provenance card={card} data={data} />
            <p className="glossary-strip"><strong>Quick glossary:</strong> <Term id="trend">Trend</Term> · <Term id="significant">Significant</Term> · <Term id="p-value">p-value</Term> · <Term id="sen">Sen&apos;s slope</Term> · <Term id="seasonal-cycle">Seasonal cycle</Term></p>
          </>
        )}
        {data.status === "ready" && series && !analysis && rangeOk === false && <div className="notice notice--warn"><AlertTriangle size={20} aria-hidden="true" /><div><strong>Check the years.</strong><p>Pick a range of at least five years between {FIRST_YEAR} and {LAST_COMPLETE_YEAR}.</p></div></div>}
        <div className="secondary-tools">
          <TrendScannerPanel state={scanner} onScan={scanPlace} onSelect={(id) => { setVarId(id); setView({ kind: "annual" }); }} />
          <CellTrendPanel state={cellMap} selectedCellId={selectedCellId} onSelectCell={setSelectedCellId} />
          {robustness && <RobustnessPanel {...robustness} onWindow={(window) => { setStart(window.startYear); setEnd(window.endYear); setView({ kind: "annual" }); }} />}
        </div>
      </section>
    </div>
  );
}

function aggregateAnnual(series: MonthlySeries, startYear: number, endYear: number) {
  return aggregate(series, { kind: "annual" }, { startYear, endYear });
}

function RobustnessPanel({
  units,
  windows,
  reference,
  onWindow,
}: {
  units: string;
  windows: RobustnessWindow[];
  reference: Analysis["stats"];
  onWindow: (window: RobustnessWindow) => void;
}) {
  const years = [...new Set(windows.flatMap((window) => [window.startYear, window.endYear]))].sort((a, b) => a - b);
  const summary = robustnessSummary(windows, reference);
  const maxMagnitude = Math.max(...windows.map((window) => Math.abs(window.stats?.sen_slope ?? 0)), 1e-12);
  const cellWidth = 34;
  const cellHeight = 26;
  const leftAxis = 42;
  const topAxis = 22;
  const colour = (window: RobustnessWindow) => {
    const slope = window.stats?.sen_slope ?? 0;
    const intensity = Math.min(1, Math.abs(slope) / maxMagnitude);
    const base = slope >= 0 ? [238, 141, 54] : [55, 126, 184];
    const alpha = window.stats && window.stats.p_value < 0.05 ? 0.25 + intensity * 0.75 : 0.12;
    return `rgba(${base.join(",")},${alpha})`;
  };
  const x = (year: number) => leftAxis + years.indexOf(year) * cellWidth;
  const y = (year: number) => topAxis + (years.length - 1 - years.indexOf(year)) * cellHeight;
  return (
    <section className="card robustness" aria-labelledby="robustness-title">
      <div className="card-head">
        <div>
          <h2 id="robustness-title">Is this trend robust?</h2>
          <p className="hint">Each cell is an overlapping start-year/end-year window. Colour shows Sen&apos;s slope ({units}/year); faded cells are not significant at p ≥ 0.05.</p>
        </div>
      </div>
      <p className="robustness-summary">In {summary.percent.toFixed(0)}% of the {summary.tested} windows we tested, the trend was the same direction and significant.</p>
      <div className="robustness-map-wrap">
        <svg className="robustness-map" role="img" aria-label="Robustness heatmap" viewBox={`0 0 ${leftAxis + Math.max(cellWidth, years.length * cellWidth)} ${topAxis + Math.max(cellHeight, years.length * cellHeight)}`}>
          {years.map((year) => <text key={`x-${year}`} x={x(year) + 2} y={16} className="robustness-label">{year}</text>)}
          {years.map((year) => <text key={`y-${year}`} x={2} y={y(year) + 17} className="robustness-label">{year}</text>)}
          {windows.map((window) => (
            <rect
              key={`${window.startYear}-${window.endYear}`}
              x={x(window.startYear)}
              y={y(window.endYear)}
              width={cellWidth - 2}
              height={cellHeight - 2}
              fill={colour(window)}
              role="button"
              tabIndex={0}
              aria-label={`${window.startYear} to ${window.endYear}${window.stats ? `, Sen slope ${window.stats.sen_slope.toFixed(3)} ${units} per year, p ${window.stats.p_value.toFixed(3)}` : ", insufficient data"}`}
              onClick={() => onWindow(window)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onWindow(window); }}
            />
          ))}
        </svg>
      </div>
      <div className="robustness-axis"><span>Start year →</span><span>End year ↑</span></div>
      <p className="hint">Windows overlap, so they are not independent tests. Click a cell to inspect that period in the main chart. Units: {units} per year.</p>
    </section>
  );
}

function TrendScannerPanel({
  state,
  onScan,
  onSelect,
}: {
  state: { status: "idle" | "loading" | "ready" | "error"; result: ScannerResult | null; error: string | null };
  onScan: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="card scanner" aria-labelledby="scanner-title">
      <div className="card-head">
        <div>
          <h2 id="scanner-title">What&apos;s changing here?</h2>
          <p className="hint">Scan every catalogue variable at this NASA POWER grid point. A false-alarm correction keeps multiple comparisons honest.</p>
        </div>
        <button className="btn btn--primary" onClick={onScan} disabled={state.status === "loading"}>
          {state.status === "loading" ? "Scanning…" : "Scan this place"}
        </button>
      </div>
      {state.status === "idle" && <p className="hint">No scan has been run yet.</p>}
      {state.status === "error" && <p className="field-error" role="alert">{state.error}</p>}
      {state.status === "loading" && <p className="hint">Requesting real NASA POWER monthly data…</p>}
      {state.result && (
        <>
          <p className="hint">{state.result.origin === "live" ? "Live (NASA POWER, retrieved " : "Cached (NASA POWER, retrieved "}{state.result.retrievedUtc.slice(0, 10)})</p>
          <div className="table-scroll">
            <table className="table scanner-table">
              <thead><tr><th>Variable</th><th>Direction</th><th>Sen&apos;s slope / decade</th><th>Total change</th><th>Change vs normal swings</th><th>Raw p</th><th>Adjusted p</th><th>Years</th></tr></thead>
              <tbody>
                {state.result.rows.map((row) => {
                  const trend = row.trend;
                  return (
                    <tr key={row.variable.id} onClick={() => onSelect(row.variable.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onSelect(row.variable.id); }}>
                      <th scope="row">{row.variable.short_name}</th>
                      <td>{trend ? (trend.direction === "increasing" ? "↑ increasing" : trend.direction === "decreasing" ? "↓ decreasing" : "— no significant trend") : "Insufficient data"}</td>
                      <td>{row.senSlopePerDecade === null ? "—" : `${row.senSlopePerDecade.toFixed(3)} ${row.units}`}</td>
                      <td>{trend ? `${trend.total_change.toFixed(3)} ${row.units}` : "—"}</td>
                      <td>{row.effectLabel}</td>
                      <td>{trend ? trend.p_value.toFixed(4) : "—"}</td>
                      <td>{row.adjustedP === null ? "—" : `${row.adjustedP.toFixed(4)}${row.significantAfterCorrection ? " *" : ""}`}</td>
                      <td>{row.yearsUsed.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function CellTrendPanel({
  state,
  selectedCellId,
  onSelectCell,
}: {
  state: { status: "idle" | "loading" | "ready" | "error"; result: RegionalTrendResult | null; error: string | null };
  selectedCellId: string | null;
  onSelectCell: (id: string) => void;
}) {
  if (state.status === "idle") return null;
  const cells = state.result?.cells ?? [];
  const rising = cells.filter((cell) => cell.stats?.p_value !== undefined && cell.stats.p_value < 0.05 && cell.stats.sen_slope > 0).length;
  const falling = cells.filter((cell) => cell.stats?.p_value !== undefined && cell.stats.p_value < 0.05 && cell.stats.sen_slope < 0).length;
  const notSignificant = cells.length - rising - falling;
  const selected = cells.find((cell) => cell.id === selectedCellId);
  return (
    <section className="card cell-trends" aria-labelledby="cell-trends-title">
      <div className="card-head">
        <div>
          <h2 id="cell-trends-title">Where is it changing?</h2>
          <p className="hint">Each rectangle is one approximately 50 km NASA POWER model grid cell. Height scales consistently with absolute Sen&apos;s slope; faded cells are not significant at p ≥ 0.05.</p>
        </div>
      </div>
      {state.status === "error" && <p className="field-error" role="alert">{state.error}</p>}
      {state.status === "loading" && <p className="hint">Requesting real NASA POWER regional cell data…</p>}
      {state.result && (
        <>
          <p className="cell-summary">{rising} cells rising, {falling} falling, {notSignificant} not significant{rising > 0 && falling > 0 ? " · Opposite trends within this region." : "."}</p>
          {selected && <div className="hint">Selected cell: {selected.latitude.toFixed(3)}°, {selected.longitude.toFixed(3)}° · {selected.stats ? `Sen's slope ${selected.stats.sen_slope.toFixed(3)} ${selected.units}, p=${selected.stats.p_value.toFixed(4)}, n=${selected.stats.sample_count}` : "insufficient data"}<details><summary>Show cell annual series</summary><div className="cell-series">{selected.years.map((year, index) => <span key={year}>{year}: {selected.annualValues[index] === null ? "missing" : `${selected.annualValues[index]} ${selected.units}`}</span>)}</div></details></div>}
          <div className="cell-legend"><span><i className="cell-legend-swatch cell-legend-swatch--up" /> Significant increasing</span><span><i className="cell-legend-swatch cell-legend-swatch--down" /> Significant decreasing</span><span><i className="cell-legend-swatch cell-legend-swatch--faded" /> Not significant</span><span>Units: {state.result.units}/year · {state.result.cells.length} cells</span></div>
        </>
      )}
      {state.result && <button className="btn btn--ghost" onClick={() => cells[0] && onSelectCell(cells[0].id)}>Select first cell</button>}
    </section>
  );
}

function clampYear(y: number) {
  return Math.min(LAST_COMPLETE_YEAR, Math.max(FIRST_YEAR, Math.round(y)));
}

function ResultsHeader({ card, place, data }: { card: VariableCard; place: Place; data: ReturnType<typeof useSeries> }) {
  const meta = data.meta;
  const origin = data.offlineSnapshot ? "Cached · saved snapshot" : meta?.origin === "live" ? "Live from NASA POWER" : meta?.origin === "cached" ? "Cached in your browser" : "Loading";
  return (
    <header className="res-head">
      <div className="res-title">
        <span className="var-icon var-icon--lg"><VarIcon id={card.id} size={26} /></span>
        <div>
          <h1>{card.short_name}</h1>
          <p><MapPin size={14} aria-hidden="true" /> {place.label} <span className="dim">· {place.sub}</span></p>
        </div>
      </div>
      <div className="badges">
        <button className="btn no-print" onClick={() => window.print()}>Print or save as PDF</button>
        <span className={`badge ${meta?.origin === "live" ? "badge--live" : "badge--cached"}`}><span className="pulse" aria-hidden="true" />{origin}</span>
        {meta?.retrieved_utc && <span className="badge">Retrieved {meta.retrieved_utc.slice(0, 10)}</span>}
        <span className="badge">NASA POWER · MERRA-2</span>
        {card.verified === false && <span className="badge badge--warn">Units confirmed on fetch</span>}
      </div>
    </header>
  );
}

function VerdictCard({ analysis, card }: { analysis: Analysis; card: VariableCard }) {
  const v = analysis.verdict;
  if (!v || !analysis.stats) {
    return (
      <div className="notice notice--warn"><AlertTriangle size={20} aria-hidden="true" /><div><strong>A trend could not be computed.</strong><p>{analysis.problem}</p></div></div>
    );
  }
  const up = v.direction === "increasing";
  const down = v.direction === "decreasing";
  return (
    <article className={`verdict ${v.significant ? "is-sig" : "is-flat"}`}>
      <div className="verdict-icon" aria-hidden="true">
        {v.significant ? (up ? <TrendingUp size={30} /> : <TrendingDown size={30} />) : <Scale size={30} />}
      </div>
      <div className="verdict-body">
        <span className="eyebrow">{v.significant ? <><CheckCircle2 size={13} aria-hidden="true" /> Statistically <Term id="significant">significant</Term> {up ? "increase" : down ? "decrease" : "change"}</> : <><Layers size={13} aria-hidden="true" /> No <Term id="significant">statistically significant</Term> trend</>}</span>
        <h2>{v.headline}</h2>
        <details className="verdict-details">
          <summary>Show evidence and caveats</summary>
          <ul>
            {v.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          <div className="careful">
            <strong><AlertTriangle size={14} aria-hidden="true" /> Be careful with this result ({v.warnings.length})</strong>
            <ul>
              {v.warnings.map((w, i) => <li key={i}>{w}</li>)}
              <li>{card.caveat}</li>
            </ul>
          </div>
        </details>
      </div>
    </article>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-sub">{sub}</span>
    </div>
  );
}

function ResultsTable({ analysis, card, place }: { analysis: Analysis; card: VariableCard; place: Place }) {
  const s = analysis.stats;
  const u = analysis.agg.units;
  const download = () => {
    const blob = new Blob([toCsv(analysis, card, place.label)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrascan_${card.id}_${place.id}_${analysis.agg.years[0]}-${analysis.agg.years[analysis.agg.years.length - 1]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const rows: Array<[ReactNodeLike, string]> = s
    ? [
        ["Years analysed", `${s.sample_count} (${analysis.agg.yearsUsed[0]}–${analysis.agg.yearsUsed[analysis.agg.yearsUsed.length - 1]})${analysis.agg.yearsSkipped.length ? `, ${analysis.agg.yearsSkipped.length} skipped` : ""}`],
        [<Term id="sen" key="sen">Sen's slope</Term>, `${fmt(s.sen_slope, true)} ${u} per year (${fmt(s.sen_slope * 10, true)} per decade)`],
        [<Term id="ci" key="ci">95% confidence range</Term>, `${fmt(s.sen_slope_ci95[0], true)} to ${fmt(s.sen_slope_ci95[1], true)} ${u} per year`],
        [<Term id="ols" key="ols">Straight-line slope (OLS)</Term>, `${fmt(s.ols_slope, true)} ${u} per year, p = ${fmtP(s.ols_p_value)}`],
        [<Term id="mk" key="mk">Mann–Kendall</Term>, `Z = ${fmt(s.mk_z, true)}, p = ${fmtP(s.p_value)} → ${s.significant ? "significant" : "not significant"} at ${s.alpha}`],
        ["Total change", `${fmt(s.total_change, true)} ${u}${s.percent_change_of_mean !== null && analysis.agg.view.kind !== "anomaly" ? ` (${fmt(s.percent_change_of_mean, true)}% of the average ${fmt(s.observed_mean)})` : ""}`],
        [<Term id="autocorr" key="ac">Lag-1 autocorrelation</Term>, s.lag1_autocorrelation === null ? "not enough data" : `${fmt(s.lag1_autocorrelation, true)}${s.lag1_autocorrelation_flag ? " (above threshold: p-value may look too certain)" : " (within limits)"}`],
      ]
    : [];
  return (
    <div className="card">
      <div className="card-head">
        <h3>The numbers</h3>
        <button className="btn" onClick={download}><Download size={14} aria-hidden="true" /> Download CSV</button>
      </div>
      <table className="table">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i}><th scope="row">{k}</th><td>{v}</td></tr>
          ))}
        </tbody>
      </table>
      {analysis.agg.yearsSkipped.length > 0 && (
        <details className="careful"><summary>Skipped years ({analysis.agg.yearsSkipped.length})</summary>
          <ul>{analysis.agg.yearsSkipped.map((y) => <li key={y.year}>{y.year}: {y.reason}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

type ReactNodeLike = React.ReactNode;

function Provenance({ card, data }: { card: VariableCard; data: ReturnType<typeof useSeries> }) {
  const m = data.meta;
  if (!m) return null;
  return (
    <div className="card prov">
      <h3>Where these numbers come from</h3>
      <dl>
        <div><dt>Dataset</dt><dd>NASA POWER monthly {m.sources.join(", ") || "MERRA-2"} · API {m.api_version ?? "unknown"}</dd></div>
        <div><dt>Variable</dt><dd>{m.parameter_names[card.id] ?? card.power_long_name} ({card.id}), {m.parameter_units[card.id] ?? card.units_monthly}</dd></div>
        <div><dt><Term id="grid">Grid cell</Term></dt><dd>asked for {m.requested.lat}°, {m.requested.lon}° · NASA used {Number.isFinite(m.grid.lat) ? `${m.grid.lat}°, ${m.grid.lon}°` : "unknown"}</dd></div>
        <div><dt>Status</dt><dd>{data.offlineSnapshot ? "Cached: saved snapshot of a real NASA POWER response (live request failed; retrieval time not recorded)" : m.origin === "live" ? `Live: fetched ${m.retrieved_utc.slice(0, 19).replace("T", " ")} UTC` : `Cached in your browser (first fetched ${m.retrieved_utc.slice(0, 19).replace("T", " ")} UTC)`}</dd></div>
        <details className="careful"><summary>Technical details</summary><p className="mono">{m.source_url}</p></details>
        <div><dt>Caveat</dt><dd>{card.caveat}</dd></div>
      </dl>
      <p className="hint">Values are never filled, interpolated or mixed with other datasets. A trend shows that something changed, not why.</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading NASA POWER data">
      <div className="sk sk--verdict" />
      <div className="sk-row"><div className="sk" /><div className="sk" /><div className="sk" /><div className="sk" /></div>
      <div className="sk sk--chart" />
      <p className="hint"><span className="pulse" aria-hidden="true" /> Asking NASA POWER for 45 years of monthly data…</p>
    </div>
  );
}



