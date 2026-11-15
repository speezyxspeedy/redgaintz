import { FIRST_YEAR, LAST_COMPLETE_YEAR, bundledSnapshot } from "./data";
import { advancedStats, type Advanced } from "./lib/advanced";
import { analyse, withPrettyUnits } from "./lib/analysis";
import { fetchPowerPoint } from "./lib/power";
import { fmtP } from "./lib/verdict";
import { VARIABLES, getVariable, rulesFor } from "./lib/variables";
import { ALL_PLACES, customPlace, findPlace, type Place } from "./theme";
import type { ChartKind } from "./AdvancedCharts";

/* ───────── Guardrails ───────── */
const INJECTION = /ignore (all |any |the )?(previous|above|prior)|disregard .*instruction|system prompt|reveal .*(prompt|instruction|key)|developer mode|jailbreak|you are now|pretend (to be|you)/i;
const KEY_LIKE = /\b(AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,})\b/g;
const PII = /([\w.+-]+@[\w-]+\.[\w.]+)|(\+?\d[\d\s-]{9,13}\d)/g;
export const MAX_INPUT = 400;

export type GuardVerdict = { ok: true; text: string } | { ok: false; reply: string };

export function guardInput(raw: string): GuardVerdict {
  if (KEY_LIKE.test(raw)) { KEY_LIKE.lastIndex = 0; return { ok: false, reply: "That looks like an API key. I did not process it. Never paste keys into a chat; add yours in the key dialog instead." }; }
  if (INJECTION.test(raw)) return { ok: false, reply: "I can't follow instructions that change my rules or reveal my setup. I can analyse NASA climate trends for a place and explain the results. Try: \"Is monsoon rain in Nagpur changing?\"" };
  const text = raw.replace(PII, "[removed]").slice(0, MAX_INPUT).trim();
  return text ? { ok: true, text } : { ok: false, reply: "Ask me about a place and a variable, for example: \"Is Gadchiroli getting hotter?\"" };
}

/** Output guard: never echo secrets, never let a model claim proof of cause. */
export function guardText(t: string): string {
  let out = t.replace(KEY_LIKE, "[removed]");
  if (/\b(proves?|proved|definitely caused|is caused by|due to climate change)\b/i.test(out)) out += "\n\nNote: a statistical trend shows that something changed, not why. TERRASCAN does not test causes.";
  return out;
}

/* ───────── Entity identification ───────── */
const VAR_WORDS: [string, RegExp][] = [
  ["T2M_MAX", /max(imum)? temp|heat ?wave|tmax|hottest|garmi ki lahar/i],
  ["T2M_MIN", /min(imum)? temp|tmin|coldest|cold night|thand/i],
  ["T2M", /temperature|temp\b|hotter|warming|warmer|cooler|garmi|tapman|heat/i],
  ["RH2M", /humid|nami|moisture in (the )?air/i],
  ["WS10M", /\bwind|hawa|breeze/i],
  ["ALLSKY_SFC_SW_DWN", /sun(shine|light)?\b|solar|radiation|dhoop|insolation/i],
  ["PRECTOTCORR", /rain|barish|baarish|varsha|precip|monsoon|drought|sukha|flood|wetter|drier/i],
];
const PLACE_ALIASES: Record<string, string> = { nagpur: "IN-MH-VID-NAG", vidarbha: "IN-MH-VID", delhi: "delhi", amazon: "amazon", thar: "thar", greenland: "greenland", sundarbans: "sundarbans" };

export type Task = "trend" | "probability" | "change" | "compare" | "forecast" | "open" | "identify";
export interface Entities { variable: string | null; place: Place | null; view: "monsoon" | "annual" | "anomaly" | null; start: number | null; end: number | null; task: Task; }

export function identify(q: string, currentRegion?: string): Entities {
  const s = q.toLowerCase();
  const variable = VAR_WORDS.find(([, re]) => re.test(s))?.[0] ?? null;
  let place: Place | null = null;
  const ll = s.match(/(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (ll && Math.abs(+ll[1]) <= 90 && Math.abs(+ll[2]) <= 180 && /[.,]/.test(ll[0])) place = customPlace(+ll[1], +ll[2]);
  if (!place) place = [...ALL_PLACES].sort((a, b) => b.label.length - a.label.length).find((p) => s.includes(p.label.toLowerCase())) ?? null;
  if (!place) { const k = Object.keys(PLACE_ALIASES).find((a) => s.includes(a)); if (k) place = findPlace(PLACE_ALIASES[k]) ?? null; }
  if (!place && currentRegion && /here|this (district|place|region)|yahan|is jagah/.test(s)) place = findPlace(currentRegion) ?? null;
  const yrs = [...s.matchAll(/\b(19[89]\d|20[0-4]\d)\b/g)].map((m) => +m[1]).sort();
  const view = /monsoon|jjas|barish|baarish|varsha/.test(s) ? "monsoon" : /anomal/.test(s) ? "anomaly" : /annual|yearly|saal/.test(s) ? "annual" : null;
  const task: Task =
    /open|show .*(globe|map)|take me|investigate|dikhao|kholo/.test(s) ? "open"
    : /predict|forecast|next (year|few)|future|aage|agla/.test(s) ? "forecast"
    : /chance|probab|risk|odds|extreme|return period|how likely|1 in|sambhav/.test(s) ? "probability"
    : /change.?point|shift|break|sudden|jump|turning/.test(s) ? "change"
    : /compare|before and after|early|late|then vs|purana/.test(s) ? "compare"
    : /which (variable|dataset)|identify|what (is|am i)|kaun sa|konsa/.test(s) && !variable ? "identify"
    : "trend";
  return { variable, place, view, start: yrs.length ? Math.max(FIRST_YEAR, yrs[0]) : null, end: yrs.length > 1 ? Math.min(LAST_COMPLETE_YEAR, yrs[yrs.length - 1]) : null, task };
}

/* ───────── Tools & output blocks ───────── */
export type Block =
  | { type: "entities"; items: [string, string][] }
  | { type: "table"; rows: [string, string][] }
  | { type: "chart"; kind: ChartKind; adv: Advanced; title: string }
  | { type: "actions"; items: { label: string; path: string; params?: Record<string, string> }[] };
export interface AgentReply { text: string; blocks: Block[]; agent: string }

const TRIGGER = /trend|change|changing|chance|probab|risk|extreme|forecast|predict|shift|compare|rain|barish|temperature|hotter|warming|humid|wind|sun|solar|drought|monsoon|garmi|open|show|identify|analy[sz]e|investigate/i;

export async function runAgent(raw: string, currentRegion?: string): Promise<AgentReply | null> {
  const g = guardInput(raw);
  if (!g.ok) return { text: g.reply, blocks: [], agent: "Guardrail" };
  const e = identify(g.text, currentRegion);
  if (!e.variable && !e.place && !TRIGGER.test(g.text)) return null;           // let the knowledge assistant answer
  if (!e.variable && e.task !== "open") {
    if (e.task === "identify" || !e.place) return null;
  }
  const place = e.place ?? findPlace(currentRegion ?? "") ?? findPlace("IN-MH-VID-NAG")!;
  const card = getVariable(e.variable ?? "PRECTOTCORR");
  const start = e.start ?? FIRST_YEAR, end = e.end && e.end - start >= 9 ? e.end : LAST_COMPLETE_YEAR;
  const view = e.view === "monsoon" && card.id === "PRECTOTCORR" ? ({ kind: "season", seasonId: "monsoon" } as const) : e.view === "anomaly" ? ({ kind: "anomaly" } as const) : e.view === "annual" ? ({ kind: "annual" } as const) : card.suggested_view;
  const ids: [string, string][] = [["Variable", `${card.short_name} (${card.id})`], ["Place", `${place.label} (${place.lat.toFixed(2)}°, ${place.lon.toFixed(2)}°)`], ["Years", `${start}–${end}`], ["Task", e.task]];
  const open: { label: string; path: string; params: Record<string, string> } = { label: "Open in Investigate", path: "/investigate", params: place.kind === "custom" ? { v: card.id, p: "custom", lat: String(place.lat), lon: String(place.lon) } : { v: card.id, p: place.id } };
  const blocks: Block[] = [{ type: "entities", items: ids }];

  if (e.task === "open") return { text: `Opening ${card.short_name} for ${place.label}.`, blocks: [...blocks, { type: "actions", items: [open, { label: "See it on the globe", path: "/explore" }] }], agent: "Task Agent" };

  let series;
  try {
    series = (await fetchPowerPoint({ lat: place.lat, lon: place.lon, startYear: FIRST_YEAR, endYear: LAST_COMPLETE_YEAR, parameters: [card.id] }, rulesFor([card.id]))).series[card.id];
  } catch {
    const snap = Math.abs(place.lat - 21.1458) < 0.05 && Math.abs(place.lon - 79.0882) < 0.05 ? bundledSnapshot().series[card.id] : undefined;
    if (!snap) return { text: `I could not reach NASA POWER for ${place.label}, so I have no numbers to report. I will not guess. Check the connection and ask again.`, blocks, agent: "Trend Detective" };
    series = snap;
  }
  const a = analyse(withPrettyUnits(series), card, view, start, end);
  if (!a.stats || !a.verdict) return { text: `A trend could not be computed: ${a.problem ?? "not enough valid years"}.`, blocks, agent: "Trend Detective" };
  const adv = advancedStats(a.agg.years, a.agg.values, a.agg.units);
  const s = a.stats, u = a.agg.units;
  const head = `**${a.agg.label}, ${place.label}, ${start}–${end}.** ${a.verdict.headline}`;
  const trendRows: [string, string][] = [
    ["Mann–Kendall p-value", fmtP(s.p_value)], ["Sen's slope", `${s.sen_slope.toFixed(3)} ${u}/yr (95%: ${s.sen_slope_ci95[0].toFixed(3)} to ${s.sen_slope_ci95[1].toFixed(3)})`],
    ["Straight-line slope (OLS)", `${s.ols_slope.toFixed(3)} ${u}/yr, p = ${fmtP(s.ols_p_value)}`], ["Years used", String(s.sample_count)],
    ["Lag-1 autocorrelation", s.lag1_autocorrelation === null ? "n/a" : `${s.lag1_autocorrelation.toFixed(2)}${s.lag1_autocorrelation_flag ? " (high: p-value may look too strong)" : ""}`],
  ];
  const foot = `Source: NASA POWER (MERRA-2), grid cell about 50 km wide. Method: Mann–Kendall and Sen's slope. Trend is not cause: this shows that values changed, not why.`;
  if (!adv || e.task === "trend") return { text: `${head}\n\n${foot}`, blocks: [...blocks, { type: "table", rows: trendRows }, { type: "actions", items: [open] }], agent: "Trend Detective" };

  const a2 = adv, rows: Record<string, [string, string][]> = {
    probability: [[`Next year as dry as the driest 10% of ${a2.baseline.label}`, `${(a2.prob.lowNext * 100).toFixed(1)}%`], [`Next year as wet as the wettest 10% of ${a2.baseline.label}`, `${(a2.prob.highNext * 100).toFixed(1)}%`], [`Dry-tail years in ${a2.prob.recentLabel} (10% expected)`, `${(a2.prob.lowObserved * 100).toFixed(0)}%`], ["Driest years", a2.returns.map((r) => `${r.year} (1 in ${r.period.toFixed(0)} yr)`).join(", ")]],
    change: [["Pettitt p-value", fmtP(a2.pettitt.p)], ["Step year", String(a2.pettitt.year)], ["Mean before → after", `${a2.pettitt.before.toFixed(2)} → ${a2.pettitt.after.toFixed(2)} ${u}`]],
    compare: [[`${a2.compare.earlyLabel} → ${a2.compare.lateLabel}`, `${a2.compare.earlyMean.toFixed(2)} → ${a2.compare.lateMean.toFixed(2)} ${u}`], ["Mann–Whitney p", fmtP(a2.compare.mwP)], ["Welch t-test p", fmtP(a2.compare.welchP)]],
    forecast: [["Straight-line value in 5 years", `${a2.forecast[a2.forecast.length - 1].fit.toFixed(2)} ${u}`], ["95% range for one year", `${a2.forecast[a2.forecast.length - 1].lo.toFixed(2)} to ${a2.forecast[a2.forecast.length - 1].hi.toFixed(2)} ${u}`]],
  };
  const chart: Record<string, ChartKind> = { probability: "ecdf", change: "change", compare: "hist", forecast: "forecast" };
  const note = e.task === "change" && !a2.pettitt.significant ? " No statistically significant change point was found." : "";
  return { text: `${head}${note}\n\n${foot}`, blocks: [...blocks, { type: "table", rows: [...rows[e.task], ...trendRows.slice(0, 2)] }, { type: "chart", kind: chart[e.task], adv: a2, title: e.task }, { type: "actions", items: [{ ...open, label: "Full analysis with all charts", params: { ...open.params, view: "" } }] }], agent: "Trend Detective" };
}
export const VARIABLE_COUNT = VARIABLES.length;
