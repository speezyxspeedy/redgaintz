import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo } from "react";
import { advancedStats, type Advanced } from "./lib/advanced";
import type { Analysis } from "./lib/analysis";
import { fmtP } from "./lib/verdict";

const OR = "#ff8a1f", TEAL = "#4fd1c5", INK = "#b9ccd8", GRID = "rgba(190,215,230,.14)";
const axis = { stroke: INK, fontSize: 12, tickLine: false } as const;
const tip = { contentStyle: { background: "#0a1f31", border: "1px solid rgba(190,215,230,.3)", borderRadius: 6, color: "#eaf2f6", fontSize: 13 } };
const f1 = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));
const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

export type ChartKind = "ecdf" | "hist" | "change" | "forecast";

export function AdvChart({ adv, kind, h = 260 }: { adv: Advanced; kind: ChartKind; h?: number }) {
  const u = adv.units;
  return (
    <div style={{ width: "100%", height: h }} role="img" aria-label={`${kind} chart of ${adv.n} yearly values in ${u}`}>
      <ResponsiveContainer>
        {kind === "ecdf" ? (
          <ComposedChart data={adv.ecdf} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke={GRID} /><XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tickFormatter={f1} {...axis} label={{ value: u, position: "insideBottom", offset: -10, fill: INK, fontSize: 12 }} />
            <YAxis tickFormatter={(v) => pct(v)} {...axis} /><Tooltip {...tip} formatter={(v) => pct(Number(v))} labelFormatter={(l) => `${f1(Number(l))} ${u}`} />
            <ReferenceLine x={adv.baseline.lowThr} stroke={TEAL} strokeDasharray="4 3" label={{ value: "dry 10%", fill: TEAL, fontSize: 11, position: "insideTopLeft" }} />
            <ReferenceLine x={adv.baseline.highThr} stroke={OR} strokeDasharray="4 3" label={{ value: "wet 10%", fill: OR, fontSize: 11, position: "insideTopRight" }} />
            <Line dataKey="p" name="Share of years at or below" type="stepAfter" stroke="#eaf2f6" dot={false} strokeWidth={2} />
          </ComposedChart>
        ) : kind === "hist" ? (
          <ComposedChart data={adv.hist} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke={GRID} /><XAxis dataKey="label" {...axis} label={{ value: `${u} (bin start)`, position: "insideBottom", offset: -10, fill: INK, fontSize: 12 }} />
            <YAxis allowDecimals={false} {...axis} label={{ value: "years", angle: -90, position: "insideLeft", fill: INK, fontSize: 12 }} /><Tooltip {...tip} />
            <Bar dataKey="count" name="Years" fill={TEAL} radius={[2, 2, 0, 0]} />
          </ComposedChart>
        ) : kind === "change" ? (
          <ComposedChart data={adv.rolling} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke={GRID} /><XAxis dataKey="year" {...axis} /><YAxis tickFormatter={f1} domain={["auto", "auto"]} {...axis} label={{ value: u, angle: -90, position: "insideLeft", fill: INK, fontSize: 12 }} />
            <Tooltip {...tip} formatter={(v) => (v == null ? "—" : f1(Number(v)))} />
            <Line dataKey="value" name="Yearly value" stroke={INK} strokeOpacity={0.55} dot={{ r: 2 }} strokeWidth={1} />
            <Line dataKey="roll" name="10-year mean" stroke={OR} dot={false} strokeWidth={2.5} connectNulls />
            <ReferenceLine x={adv.pettitt.year} stroke={adv.pettitt.significant ? OR : INK} strokeDasharray="5 4" label={{ value: `${adv.pettitt.significant ? "Shift" : "Largest step"} ${adv.pettitt.year}`, fill: INK, fontSize: 11, position: "insideTopLeft" }} />
          </ComposedChart>
        ) : (
          <ComposedChart data={adv.forecast.map((d) => ({ ...d, band: [d.lo, d.hi] }))} margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
            <CartesianGrid stroke={GRID} /><XAxis dataKey="year" {...axis} /><YAxis tickFormatter={f1} domain={["auto", "auto"]} {...axis} label={{ value: u, angle: -90, position: "insideLeft", fill: INK, fontSize: 12 }} />
            <Tooltip {...tip} formatter={(v) => (Array.isArray(v) ? `${f1(v[0])} to ${f1(v[1])}` : v == null ? "—" : f1(Number(v)))} />
            <Area dataKey="band" name="95% range for a single year" stroke="none" fill={OR} fillOpacity={0.18} />
            <Line dataKey="fit" name="Straight-line fit" stroke={OR} dot={false} strokeWidth={2} strokeDasharray="6 3" />
            <Line dataKey="value" name="Observed" stroke="#eaf2f6" dot={{ r: 2 }} strokeWidth={1.5} />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function advSummary(a: Advanced) {
  return [
    ["Chance next year is as dry as the driest 10% of " + a.baseline.label, pct(a.prob.lowNext)],
    ["Chance next year is as wet as the wettest 10% of " + a.baseline.label, pct(a.prob.highNext)],
    [`Dry-tail years seen in ${a.prob.recentLabel} (expected 10%)`, pct(a.prob.lowObserved)],
    [`Wet-tail years seen in ${a.prob.recentLabel} (expected 10%)`, pct(a.prob.highObserved)],
    [`Change point (Pettitt), p = ${fmtP(a.pettitt.p)}`, a.pettitt.significant ? `${a.pettitt.year}: ${f1(a.pettitt.before)} to ${f1(a.pettitt.after)} ${a.units}` : `none significant (largest step ${a.pettitt.year})`],
    [`${a.compare.earlyLabel} vs ${a.compare.lateLabel}`, `${f1(a.compare.earlyMean)} to ${f1(a.compare.lateMean)} ${a.units}; Mann–Whitney p = ${fmtP(a.compare.mwP)}, Welch p = ${fmtP(a.compare.welchP)}`],
    ["Driest years (return period)", a.returns.map((r) => `${r.year} (1 in ${r.period.toFixed(0)} yr)`).join(", ")],
  ] as [string, string][];
}

const SECTIONS: { kind: ChartKind; title: string; read: string }[] = [
  { kind: "ecdf", title: "How often is a year this low?", read: "Each step is one year. The dashed lines mark the driest and wettest 10% of the baseline period." },
  { kind: "hist", title: "Spread of yearly values", read: "How many years fall in each band. A wide spread means one odd year says little." },
  { kind: "change", title: "Has the level shifted?", read: "Orange is the 10-year average. The dashed line is the Pettitt test's best guess for a step change." },
  { kind: "forecast", title: "Where the straight line points", read: "A statistical extension of the fitted line for five years, not a weather forecast. The band is where a single year would fall 95% of the time." },
];

export function ProbabilityPanel({ analysis }: { analysis: Analysis }) {
  const adv = useMemo(() => advancedStats(analysis.agg.years, analysis.agg.values, analysis.agg.units), [analysis]);
  if (!adv) return <p className="hint">At least 10 valid years are needed for probability and change-point tests.</p>;
  return (
    <div className="adv">
      <dl className="adv-sum">{advSummary(adv).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <div className="adv-grid">
        {SECTIONS.map((s) => (<figure key={s.kind}><figcaption><strong>{s.title}</strong><span>{s.read}</span></figcaption><AdvChart adv={adv} kind={s.kind} /></figure>))}
      </div>
      <p className="hint">Probabilities assume yearly values scatter around the fitted line the way they did in the past. A significant test shows a change, not its cause. Change point: Pettitt (1979) [6]; trend: Sen (1968) [5].</p>
    </div>
  );
}
