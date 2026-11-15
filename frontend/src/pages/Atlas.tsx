import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Refs } from "../Lineage";
import { go } from "../components";
import { FIRST_YEAR, LAST_COMPLETE_YEAR } from "../data";
import { analyse, withPrettyUnits } from "../lib/analysis";
import { fetchPowerPoint } from "../lib/power";
import { fmtP } from "../lib/verdict";
import { VARIABLES, getVariable, rulesFor } from "../lib/variables";
import { DISTRICT_PLACES } from "../theme";

interface Row { id: string; name: string; lat: number; lon: number; cell: string; slope: number; pct: number | null; p: number; sig: boolean; units: string }
type Geo = { features: { properties: { region_id?: string; level?: string }; geometry: { type: string; coordinates: any } }[] };

const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const LOW = [255, 138, 31], MID = [91, 113, 132], HIGH = [43, 181, 168];
const colour = (t: number) => `rgb(${(t < 0 ? lerp(MID, LOW, -t) : lerp(MID, HIGH, t)).join(",")})`;
const ids = VARIABLES.filter((v) => v.verified !== false);

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

export default function Atlas() {
  const [varId, setVarId] = useState("PRECTOTCORR");
  const [monsoon, setMonsoon] = useState(true);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(0);
  const card = getVariable(varId);
  const view = monsoon && varId === "PRECTOTCORR" ? ({ kind: "season", seasonId: "monsoon" } as const) : ({ kind: "annual" } as const);

  useEffect(() => { fetch(`${import.meta.env.BASE_URL}boundaries/IN-MH-VID.display.geojson`).then((r) => r.json()).then(setGeo).catch(() => {}); }, []);

  useEffect(() => {
    let live = true; setRows(null); setFailed(0);
    pool(DISTRICT_PLACES, 4, async (d) => {
      try {
        const r = await fetchPowerPoint({ lat: d.lat, lon: d.lon, startYear: FIRST_YEAR, endYear: LAST_COMPLETE_YEAR, parameters: [varId] }, rulesFor([varId]));
        const a = analyse(withPrettyUnits(r.series[varId]), card, view, FIRST_YEAR, LAST_COMPLETE_YEAR);
        if (!a.stats) return null;
        const s = a.stats;
        return { id: d.regionId ?? d.id, name: d.label, lat: d.lat, lon: d.lon, cell: `${r.meta.grid.lat},${r.meta.grid.lon}`, slope: s.sen_slope, pct: s.observed_mean ? (s.sen_slope / Math.abs(s.observed_mean)) * 1000 : null, p: s.p_value, sig: s.significant, units: a.agg.units } as Row;
      } catch { return null; }
    }).then((r) => { if (!live) return; const ok = r.filter((x): x is Row => !!x); setRows(ok); setFailed(r.length - ok.length); });
    return () => { live = false; };
  }, [varId, monsoon]);

  const shapes = useMemo(() => {
    if (!geo) return null;
    const feats = geo.features.filter((f) => f.properties.level !== "region" && f.properties.region_id !== "IN-MH-VID");
    const pts = feats.flatMap((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat()).flat() as number[][]);
    const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
    const k = Math.cos(((y0 + y1) / 2) * (Math.PI / 180)), S = 560 / ((x1 - x0) * k);
    const P = (lo: number, la: number): [number, number] => [(lo - x0) * k * S + 10, (y1 - la) * S + 10];
    const d = (f: (typeof feats)[number]) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).map((poly: number[][][]) => poly.map((r) => "M" + r.map(([lo, la]) => P(lo, la).map((n) => n.toFixed(1)).join(",")).join("L") + "Z").join("")).join("");
    return { paths: feats.map((f) => ({ id: f.properties.region_id!, d: d(f) })), P, w: (x1 - x0) * k * S + 20, h: (y1 - y0) * S + 20 };
  }, [geo]);

  const max = rows ? Math.max(0.0001, ...rows.map((r) => Math.abs(r.pct ?? 0))) : 1;
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const sorted = rows ? [...rows].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0)) : [];
  const sig = sorted.filter((r) => r.sig), cells = new Set(rows?.map((r) => r.cell)).size;
  const dir = (r: Row) => (r.slope > 0 ? "▲" : r.slope < 0 ? "▼" : "•");
  const summary = !rows ? "" : sig.length === 0
    ? `No district shows a statistically significant ${card.short_name.toLowerCase()} trend over ${FIRST_YEAR}–${LAST_COMPLETE_YEAR}. That is a valid result: the yearly ups and downs are larger than any steady drift.`
    : `${sig.length} of ${rows.length} districts show a significant trend in ${card.short_name.toLowerCase()} (${sig.filter((r) => r.slope > 0).length} up, ${sig.filter((r) => r.slope < 0).length} down). The strongest is ${sig.sort((a, b) => Math.abs(b.pct ?? 0) - Math.abs(a.pct ?? 0))[0].name}.`;

  return (
    <div className="page atlas">
      <header className="page-head">
        <h1>Where in Vidarbha is it changing?</h1>
        <p className="lede">The same trend test, run on all 11 districts at once, using NASA POWER data for {FIRST_YEAR}–{LAST_COMPLETE_YEAR}. Solid colour means the change is statistically significant. Hatched means it is not.</p>
      </header>

      <div className="atlas-controls no-print">
        <div className="xp-seg" role="group" aria-label="Variable">
          {ids.map((v) => <button key={v.id} aria-pressed={varId === v.id} onClick={() => setVarId(v.id)}>{v.short_name}</button>)}
        </div>
        {varId === "PRECTOTCORR" && (
          <div className="xp-seg" role="group" aria-label="Season">
            <button aria-pressed={monsoon} onClick={() => setMonsoon(true)}>Monsoon (Jun–Sep)</button>
            <button aria-pressed={!monsoon} onClick={() => setMonsoon(false)}>Whole year</button>
          </div>
        )}
        <button className="btn" onClick={() => window.print()}><Printer size={14} aria-hidden="true" /> Print or save as PDF</button>
      </div>

      <div className="atlas-body">
        <figure className="atlas-map">
          {!shapes || !rows ? <div className="globe-loading" role="status">Testing 11 districts against 45 years of NASA data…</div> : (
            <svg viewBox={`0 0 ${shapes.w} ${shapes.h}`} role="img" aria-label={`Map of Vidarbha districts coloured by ${card.short_name} trend`}>
              <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#0c2236" /><line x1="0" y1="0" x2="0" y2="6" stroke="#5b7184" strokeWidth="2" /></pattern></defs>
              {shapes.paths.map((p) => { const r = byId.get(p.id); return <path key={p.id} d={p.d} fill={!r ? "#0c2236" : r.sig ? colour((r.pct ?? 0) / max) : "url(#hatch)"} stroke={r?.sig ? "#eaf2f6" : "#8fa8b9"} strokeWidth={r?.sig ? 1.6 : 1} strokeDasharray={r?.sig ? undefined : "4 3"} className="atlas-d" onClick={() => go("/investigate", { v: varId, p: p.id })}><title>{r ? `${r.name}: ${r.sig ? "significant" : "not significant"}` : p.id}</title></path>; })}
              {rows.map((r) => { const [x, y] = shapes.P(r.lon, r.lat); return <text key={r.id} x={x} y={y} textAnchor="middle" className="atlas-l"><tspan x={x}>{r.name}</tspan><tspan x={x} dy="14">{dir(r)} {r.pct === null ? "" : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%`}</tspan></text>; })}
            </svg>
          )}
          <figcaption>
            <span className="atlas-scale"><i style={{ background: `linear-gradient(90deg, ${colour(-1)}, ${colour(0)}, ${colour(1)})` }} /></span>
            <span>−{max.toFixed(1)}% per decade</span><span>0</span><span>+{max.toFixed(1)}% per decade</span>
          </figcaption>
        </figure>

        <div className="atlas-side">
          <p className="atlas-sum" role="status">{summary}</p>
          {rows && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>District</th><th>Change per decade</th><th>p-value</th><th>Result</th></tr></thead>
                <tbody>{sorted.map((r) => (
                  <tr key={r.id}><th scope="row"><a href={`#/investigate?v=${varId}&p=${r.id}`}>{r.name}</a></th><td>{dir(r)} {r.pct === null ? "n/a" : `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%`} ({(r.slope * 10).toFixed(2)} {r.units}/decade)</td><td>{fmtP(r.p)}</td><td>{r.sig ? "Significant" : "Not significant"}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {rows && <p className="chart-source">Source: NASA POWER (MERRA-2), retrieved live or from this browser's cache. District outlines: geoBoundaries. Analysis: TERRASCAN.</p>}
          {rows && <details className="careful"><summary>References</summary><Refs ids={[1, 2, 3, 5, 7]} /></details>}
          {rows && <p className="hint">NASA POWER grid cells are about 50 km wide, so neighbouring districts often share a cell. These 11 districts use {cells} distinct cells, which means some neighbouring colours are not independent evidence. Method: Mann–Kendall test and Sen's slope, 5% level. A trend shows change, not its cause.{failed ? ` ${failed} district(s) could not be loaded.` : ""}</p>}
        </div>
      </div>
    </div>
  );
}
