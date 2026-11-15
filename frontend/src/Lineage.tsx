import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { Analysis } from "./lib/analysis";
import type { PowerMeta } from "./lib/power";
import { fmtP } from "./lib/verdict";
import type { VariableCard } from "./lib/variables";
import type { Place } from "./theme";

/** Every reference here is a real, citable source. Numbers in the UI point to these. */
export const REFS: Record<number, { cite: string; href: string }> = {
  1: { cite: "NASA Langley Research Center (LaRC) POWER Project, funded through the NASA Earth Science / Applied Science Program. POWER Data Access Viewer and API.", href: "https://power.larc.nasa.gov/" },
  2: { cite: "Gelaro, R. et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). Journal of Climate, 30(14), 5419–5454.", href: "https://doi.org/10.1175/JCLI-D-16-0758.1" },
  3: { cite: "Mann, H. B. (1945). Nonparametric tests against trend. Econometrica, 13(3), 245–259.", href: "https://doi.org/10.2307/1907187" },
  4: { cite: "Kendall, M. G. (1975). Rank Correlation Methods (4th ed.). Charles Griffin, London.", href: "https://archive.org/details/rankcorrelationm0000kend" },
  5: { cite: "Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. Journal of the American Statistical Association, 63(324), 1379–1389.", href: "https://doi.org/10.1080/01621459.1968.10480934" },
  6: { cite: "Pettitt, A. N. (1979). A non-parametric approach to the change-point problem. Journal of the Royal Statistical Society C (Applied Statistics), 28(2), 126–135.", href: "https://doi.org/10.2307/2346729" },
  7: { cite: "Runfola, D. et al. (2020). geoBoundaries: A global database of political administrative boundaries. PLOS ONE, 15(4), e0231866.", href: "https://doi.org/10.1371/journal.pone.0231866" },
  8: { cite: "Imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Observing System Data and Information System (EOSDIS).", href: "https://earthdata.nasa.gov/gibs" },
};

export function Refs({ ids }: { ids: number[] }) {
  return (
    <ol className="refs">
      {ids.map((n) => <li key={n} value={n}><span>{REFS[n].cite}</span> <a href={REFS[n].href} target="_blank" rel="noopener noreferrer">Open source</a></li>)}
    </ol>
  );
}
const R = ({ n }: { n: number[] }) => <sup className="ref">[{n.join(", ")}]</sup>;

interface Props { card: VariableCard; meta: PowerMeta; analysis: Analysis; place: Place; offline: boolean }

export default function Lineage({ card, meta, analysis, place, offline }: Props) {
  const [copied, setCopied] = useState(false);
  const { agg, stats } = analysis;
  const used = agg.yearsUsed.length, total = agg.years.length;
  const vals = agg.values.filter((v): v is number => v !== null);
  const sd = vals.length > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - vals.reduce((a, b) => a + b, 0) / vals.length) ** 2, 0) / (vals.length - 1)) : null;
  const snr = stats && sd ? Math.abs(stats.total_change) / sd : null;
  const when = meta.retrieved_utc ? meta.retrieved_utc.slice(0, 10) : "saved snapshot (time not recorded)";
  const cell = Number.isFinite(meta.grid.lat) ? `${meta.grid.lat}°, ${meta.grid.lon}°` : "not reported";
  const cite = `NASA POWER Project (NASA Langley Research Center). ${card.power_long_name} (${card.id}), monthly, MERRA-2 based, grid cell ${cell}. Retrieved ${when}. Years ${agg.years[0]}–${agg.years[total - 1]} analysed with TERRASCAN (Mann–Kendall test, Sen's slope).`;
  const copy = async () => { try { await navigator.clipboard.writeText(cite); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ } };

  const steps: { title: string; body: React.ReactNode }[] = [
    { title: "Source", body: <>NASA POWER monthly API {meta.api_version ?? ""}, parameter <b>{card.id}</b> ({meta.parameter_names[card.id] ?? card.power_long_name}) in {meta.parameter_units[card.id] ?? card.units_monthly}. Built from {meta.sources.join(", ") || "MERRA-2"} reanalysis, not from a single instrument. <R n={[1, 2]} /> {offline ? "This is the saved NASA response shipped with the app." : meta.origin === "live" ? `Requested live on ${when}.` : `Browser-cached copy of a live request from ${when}.`}</> },
    { title: "Place", body: <>You chose {place.label} ({place.lat.toFixed(2)}°, {place.lon.toFixed(2)}°). NASA answered with the grid cell centred at {cell}, about 50 km across. The number describes that whole cell, not the exact spot.</> },
    { title: "Yearly value", body: <>{agg.method_note} {used} of {total} years were usable{agg.yearsSkipped.length ? `; ${agg.yearsSkipped.length} skipped because a month was missing, never filled in` : ""}.</> },
    { title: "Trend test", body: stats ? <>Mann–Kendall <R n={[3, 4]} /> gave p = {fmtP(stats.p_value)}. Sen's slope <R n={[5]} /> is {stats.sen_slope.toFixed(3)} {agg.units}/yr (95% range {stats.sen_slope_ci95[0].toFixed(3)} to {stats.sen_slope_ci95[1].toFixed(3)}). A straight-line fit gives {stats.ols_slope.toFixed(3)} {agg.units}/yr as a cross-check. Significance level 5%.</> : <>Not computed: {analysis.problem}</> },
    { title: "How to read it", body: stats && snr !== null ? <>{analysis.verdict?.plain} Over the period the trend adds up to {stats.total_change.toFixed(2)} {agg.units}, which is {snr.toFixed(1)}× the typical year-to-year spread ({sd!.toFixed(2)} {agg.units}). {snr < 1 ? "A change smaller than one normal year is easy to miss by eye." : "The change is larger than normal year-to-year swings."}</> : <>No reading available.</> },
  ];

  return (
    <section className="card lineage" aria-labelledby="lin-h">
      <header className="lin-head">
        <div><h3 id="lin-h">Data passport</h3><p>Every number above, traced back to its source.</p></div>
        <button className="btn no-print" onClick={copy}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? "Copied" : "Copy citation"}</button>
      </header>
      <div className="lin-quality" aria-label={`${used} of ${total} years usable`}>
        <span>Data completeness</span>
        <div className="lin-bar"><i style={{ width: `${(used / total) * 100}%` }} /></div>
        <strong>{used}/{total} years</strong>
      </div>
      <ol className="lin-steps">{steps.map((s) => <li key={s.title}><h4>{s.title}</h4><p>{s.body}</p></li>)}</ol>
      <details className="careful"><summary>References</summary><Refs ids={[1, 2, 3, 4, 5]} /></details>
    </section>
  );
}
