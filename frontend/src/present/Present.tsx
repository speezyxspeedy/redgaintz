import {
  ArrowDown, ArrowLeft, ArrowRight, BarChart3, Check, ChevronRight, CircleHelp, Database,
  Globe2, Layers3, Maximize, MessageCircle, RotateCcw, ShieldCheck, Sparkles, Target,
  Terminal, Users, Waves, type LucideIcon,
} from "lucide-react";
import { Component, lazy, Suspense, type ErrorInfo, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import packageJson from "../../../package.json";
import { LANGUAGES } from "../i18n";
import { DISTRICT_PLACES } from "../theme";
import { VARIABLES } from "../lib/variables";
import type { AnalysisResult } from "../types";
import { TEAM, TEAM_NAME } from "../config/team";
import "./present.css";

interface Props { result: AnalysisResult | null; }
interface BoundaryProps { children: ReactNode; onExit: () => void; }

const LazyGlobe = lazy(() => import("../Globe"));

class SlideBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* isolate a failed slide from the rest of the deck */ }
  render() {
    return this.state.failed
      ? <section className="present-slide present-fallback" aria-label="Slide unavailable"><div className="present-card"><span className="section-label">Slide unavailable</span><h2>This slide needs a reload</h2><p>The rest of the presentation is still available.</p><button className="present-cta" onClick={this.props.onExit}>Return to TERRASCAN</button></div></section>
      : this.props.children;
  }
}

function Metric({ label, value, unit, tone = "" }: { label: string; value: string; unit?: string; tone?: string }) {
  return <div className={`present-metric ${tone}`}><span>{label}</span><strong>{value}</strong>{unit && <small>{unit}</small>}</div>;
}

function MiniChart({ result }: { result: AnalysisResult }) {
  const [active, setActive] = useState<number | null>(null);
  const points = result.observations.filter((item) => item.value !== null);
  if (points.length < 2) return <div className="present-empty"><CircleHelp size={22} /> The saved run has too few valid observations for a chart.</div>;
  const min = Math.min(...points.map((p) => p.value as number));
  const max = Math.max(...points.map((p) => p.value as number));
  const span = max - min || 1;
  const pointAt = (value: number, index: number) => ({
    x: 32 + (index / (points.length - 1)) * 536,
    y: 170 - ((value - min) / span) * 124,
  });
  const path = points.map((point, index) => {
    const p = pointAt(point.value as number, index);
    return `${index ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(" ");
  return <svg className="present-chart" viewBox="0 0 600 210" role="img" aria-label={`Saved ${result.variable} observations from ${points[0].time} to ${points[points.length - 1].time}`}>
    <defs><linearGradient id="present-line" x1="0" x2="1"><stop stopColor="#4FD1C5" /><stop offset="1" stopColor="#FF8A1F" /></linearGradient></defs>
    <path d="M32 170H568" className="chart-axis" /><path d="M32 108H568" className="chart-grid" /><path d="M32 46H568" className="chart-grid" /><path d={path} className="chart-line" />
    {points.map((point, index) => { const p = pointAt(point.value as number, index); return <circle key={point.time} cx={p.x} cy={p.y} r={active === index ? "7" : "3.5"} className={`chart-dot ${active === index ? "is-active" : ""}`} tabIndex={0} role="button" aria-label={`${point.time}: ${point.value} ${result.units}`} onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onPointerLeave={() => setActive(null)} />; })}
    <text x="32" y="198">{points[0].time}</text><text x="568" y="198" textAnchor="end">{points[points.length - 1].time}</text><text x="32" y="18">{result.units}</text>
    {active !== null && <g className="chart-tooltip"><rect x={Math.min(390, pointAt(points[active].value as number, active).x - 30)} y="22" width="160" height="32" rx="6" /><text x={Math.min(400, pointAt(points[active].value as number, active).x - 20)} y="43">{points[active].time}: {points[active].value} {result.units}</text></g>}
  </svg>;
}

function DataFooter({ result }: { result: AnalysisResult | null }) {
  return <p className="present-data-footer">Data: NASA POWER (monthly) - retrieved {result?.provenance.access_date?.slice(0, 10) ?? "date from run"} - Map imagery: NASA GIBS / Esri</p>;
}

function GlobeMotif() {
  return <svg className="globe-motif" viewBox="0 0 420 340" role="img" aria-label="Stylised globe motif"><circle cx="210" cy="170" r="118" /><ellipse cx="210" cy="170" rx="118" ry="48" /><ellipse cx="210" cy="170" rx="48" ry="118" /><path d="M92 170h236M112 108h196M112 232h196" /><path d="M210 52v236" /></svg>;
}

function GlobeVisual({ result, compact = false }: { result: AnalysisResult | null; compact?: boolean }) {
  return <div className={`real-globe ${compact ? "real-globe--compact" : ""}`} aria-label="Interactive Cesium globe showing Vidarbha">
    <Suspense fallback={<GlobeMotif />}>
      <LazyGlobe
        selectedRegionId={result?.region_id ?? "IN-MH-VID"}
        onSelectRegion={() => undefined}
        showBoundaries
        showWorldBoundaries={false}
        showIndiaStates
        preset="vidarbha"
        onImageryStatus={() => undefined}
      />
    </Suspense>
    <span className="globe-hint"><Globe2 size={14} /> Drag to explore · use the map controls</span>
  </div>;
}

function IconBadge({ Icon, tone = "teal" }: { Icon: LucideIcon; tone?: "teal" | "orange" | "blue" }) {
  return <span className={`icon-badge icon-badge--${tone}`}><Icon size={22} aria-hidden="true" /></span>;
}

function TitleHero({ result }: { result: AnalysisResult | null }) {
  const url = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return <div className="title-hero">
    <div className="hero-copy"><span className="section-label">NASA SPACE APPS 2026 · NAGPUR</span><h1><em>TERRASCAN</em><br />Be an Earth System<br />Trend Detective</h1><p>Real NASA data. Tested trends. Clear answers for Vidarbha.</p><div className="hero-chips"><span><Users size={15} /> {TEAM_NAME}</span><span><Globe2 size={15} /> NASA Space Apps Challenge 2026 · Nagpur</span><span><ArrowRight size={15} /> {url}</span></div></div>
    <div className="hero-visual"><div className="orbit-glow" /><GlobeVisual result={result} /></div>
    <div className="hero-foot"><span>01 / 12</span><span>Real evidence, clearly explained</span></div>
  </div>;
}

function SplitSlide({ children, visual, label = "PRODUCT VIEW" }: { children: ReactNode; visual: ReactNode; label?: string }) {
  return <div className="split-layout"><div className="split-copy">{children}</div><div className="browser-frame"><div className="browser-bar"><i /><i /><i /><span>{label}</span></div><div className="browser-body">{visual}</div></div></div>;
}

function CardGrid({ cards, columns = 3 }: { cards: Array<{ Icon: LucideIcon; title: string; body: string; tone?: "teal" | "orange" | "blue" }>; columns?: 3 | 4 }) {
  return <div className={`card-grid card-grid--${columns}`}>{cards.map(({ Icon, title, body, tone }, index) => <article className="pitch-card" style={{ ["--delay" as string]: `${index * 80}ms` }} key={title}><IconBadge Icon={Icon} tone={tone} /><span className="card-index">0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}</div>;
}

function FlowSlide({ items, accentIndex }: { items: Array<{ title: string; body: string; Icon: LucideIcon }>; accentIndex?: number }) {
  return <div className="flow-wrap"><div className="flow-track">{items.map(({ title, body, Icon }, index) => <div className={`flow-node ${index === accentIndex ? "is-accent" : ""}`} style={{ ["--delay" as string]: `${index * 80}ms` }} key={title}><span className="flow-num">{index + 1}</span><Icon size={24} /><strong>{title}</strong><span>{body}</span>{index < items.length - 1 && <ChevronRight className="flow-arrow" size={24} aria-hidden="true" />}</div>)}</div></div>;
}

function StatBand({ result }: { result: AnalysisResult | null }) {
  return <div className="stat-band"><Metric label="Catalogue variables" value={String(VARIABLES.length)} /><Metric label="Vidarbha districts" value={String(DISTRICT_PLACES.length)} /><Metric label="Interface languages" value={String(LANGUAGES.length)} /><Metric label="Saved run" value={result ? (result.provenance.data_origin === "live" ? "Live" : "Cached") : "Ready"} tone={result ? "is-live" : ""} /></div>;
}

function ResultPanel({ result, compact = false }: { result: AnalysisResult | null; compact?: boolean }) {
  if (!result) return <EmptyState />;
  const trend = result.trend;
  const sampleCount = trend?.sample_count ?? result.observations.filter((item) => item.value !== null).length;
  const direction = trend?.direction ?? "not reported";
  return <div className={`result-panel ${compact ? "result-panel--compact" : ""}`}><div className="result-meta"><span className="live-badge"><i /> {result.provenance.data_origin === "live" ? "Live" : "Cached"}</span><span>{result.region_id}</span><span>{result.variable}</span></div><div className="result-verdict"><span className="section-label">VERDICT</span><h3>{trend?.significant ? direction : "No significant trend"}</h3><p>{trend?.interpretation ?? result.findings ?? "Computed result available from the saved run."}</p></div><div className="present-grid metrics"><Metric label="p-value" value={trend?.p_value === undefined ? "—" : trend.p_value.toPrecision(3)} /><Metric label="Sen's slope" value={trend?.sen_slope === undefined ? "—" : trend.sen_slope.toPrecision(3)} unit={result.units} /><Metric label="Years used" value={String(sampleCount)} /><Metric label="Total change" value={trend?.total_change === undefined ? "—" : trend.total_change.toPrecision(3)} unit={result.units} /></div><MiniChart result={result} /><p className="present-source">Source: {result.dataset_id} · retrieved {result.provenance.access_date.slice(0, 10)} · run {result.run_id} · units: {result.units}</p></div>;
}

function EmptyState() {
  return <div className="present-empty"><CircleHelp size={24} /><div><strong>Run an investigation to populate this slide.</strong><p>No saved real result is available in this session.</p></div><a className="present-cta" href="#/investigate">Open Investigate</a></div>;
}

function ReadOnlyVisual({ Icon, title, body, result }: { Icon: LucideIcon; title: string; body: string; result: AnalysisResult | null }) {
  return <article className="readonly-visual"><div className="readonly-head"><IconBadge Icon={Icon} tone="teal" /><span className="live-badge">{result ? "Read-only" : "Empty state"}</span></div><h3>{title}</h3><p>{body}</p><div className="readonly-lines"><i /><i /><i /></div><span className="readonly-foot">{result ? "Uses the saved result state" : "No fabricated data"}</span></article>;
}

function TechStack() {
  const deps = packageJson.dependencies as Record<string, string>;
  const used = [
    ["react", "React"], ["vite", "Vite"], ["typescript", "TypeScript"], ["cesium", "CesiumJS"],
    ["lucide-react", "Lucide"], ["recharts", "Recharts"], ["@google/generative-ai", "Gemini optional"],
  ].filter(([key]) => deps[key] || key === "typescript");
  return <div className="tech-grid">{used.map(([, label]) => <span key={label}><Check size={15} />{label}</span>)}</div>;
}

function ArchitectureDiagram() {
  return <div className="architecture"><div className="arch-node"><Terminal size={20} /><strong>Browser app</strong><small>React + Vite</small></div><ArrowDown className="arch-arrow" /><div className="arch-row"><div className="arch-node"><Database size={20} /><strong>NASA POWER</strong><small>Monthly data</small></div><div className="arch-node"><Globe2 size={20} /><strong>GIBS / Esri</strong><small>Map imagery</small></div></div><div className="arch-node arch-cache"><Layers3 size={20} /><strong>Saved real run</strong><small>Offline / weak network path</small></div></div>;
}

function Present({ result }: Props) {
  const [slide, setSlide] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const exit = () => { window.location.hash = "#/"; };
  const slides = useMemo(() => [
    <TitleHero result={result} />,
    <SplitSlide label="INVESTIGATE / RESULT" visual={<ResultPanel result={result} compact />}><span className="section-label">02 · PROBLEM STATEMENT</span><h2>A graph can show change without proving it</h2><div className="pain-list"><article><IconBadge Icon={BarChart3} tone="orange" /><strong>Hard to read data</strong><span>Lines and units need context before they become useful.</span></article><article><IconBadge Icon={CircleHelp} tone="blue" /><strong>No sign of reliability</strong><span>A visible change still needs a statistical test.</span></article><article><IconBadge Icon={MessageCircle} tone="teal" /><strong>No local plain-language evidence</strong><span>People need a careful answer, not a black box.</span></article></div><p className="slide-caption">Same data, two ways to read it.</p><DataFooter result={result} /></SplitSlide>,
    <div><span className="section-label">03 · OBJECTIVES</span><h2>Make a careful answer feel simple</h2><CardGrid columns={4} cards={[{ Icon: Waves, title: "Choose a NASA variable", body: "Start with a measured quantity and explicit units.", tone: "teal" }, { Icon: Target, title: "Pick any place", body: "Explore Vidarbha, a district, or another place.", tone: "orange" }, { Icon: ShieldCheck, title: "Test the trend honestly", body: "Show significance, uncertainty, and limitations.", tone: "blue" }, { Icon: Sparkles, title: "Explain it simply", body: "Turn computed evidence into plain language.", tone: "teal" }]} /></div>,
    <div><span className="section-label">04 · PROPOSED SOLUTION</span><h2>One workspace from question to evidence</h2><SplitSlide label="TERRASCAN / INVESTIGATE" visual={<div className="investigate-visual"><div className="mock-rail"><b>01</b><span>Variable</span><b>02</b><span>Place</span><b>03</b><span>Years</span></div><div className="mock-map"><GlobeVisual result={result} compact /></div><div className="mock-verdict"><span>RESULT</span><strong>Tested evidence first</strong><small>Metrics · chart · provenance</small></div></div>}><div className="callout-list"><span><b>01</b>Set the question with a control rail.</span><span><b>02</b>Explore a real geographic context.</span><span><b>03</b>Read the verdict, chart, and provenance together.</span></div><StatBand result={result} /></SplitSlide></div>,
    <div><span className="section-label">05 · USER FLOW</span><h2>Every investigation follows the same trail</h2><FlowSlide items={[{ title: "What?", body: "Variable", Icon: Waves }, { title: "Where?", body: "Place", Icon: Globe2 }, { title: "Which years?", body: "Time range", Icon: Target }, { title: "Verdict", body: "Tested trend", Icon: ShieldCheck }, { title: "Evidence", body: "Chart + source", Icon: BarChart3 }, { title: "Optional AI", body: "Explanation", Icon: MessageCircle }]} /></div>,
    <div><span className="section-label">06 · HOW THE SCIENCE WORKS</span><h2>From monthly data to an honest limit</h2><FlowSlide accentIndex={4} items={[{ title: "NASA POWER", body: "Monthly data", Icon: Database }, { title: "Clean", body: "Missing stays missing", Icon: Check }, { title: "Aggregate", body: "Rain summed to totals", Icon: Layers3 }, { title: "Test", body: "MK · Sen · OLS · lag-1", Icon: BarChart3 }, { title: "Verdict", body: "Evidence + limits", Icon: ShieldCheck }]} /><div className="orange-callout"><span>KEY PRINCIPLE</span><strong>A non-significant result is a valid result.</strong></div><DataFooter result={result} /></div>,
    <div><span className="section-label">07 · LIVE RESULT</span><h2>Show the result, not a made-up headline</h2><ResultPanel result={result} /><DataFooter result={result} /></div>,
    <div><span className="section-label">08 · WHAT MAKES US DIFFERENT</span><h2>One result, three ways to challenge it</h2><CardGrid columns={3} cards={[{ Icon: BarChart3, title: "Trend Scanner", body: "Which variables are changing at this place? Read-only view from saved data.", tone: "teal" }, { Icon: Layers3, title: "Robustness Explorer", body: "Does the conclusion hold across different year windows?", tone: "orange" }, { Icon: Globe2, title: "Regional cell trends", body: "Compare real NASA grid cells and see opposite directions where present.", tone: "blue" }]} /><div className="difference-strip"><Check size={20} /> Never hides “no significant trend”.</div><DataFooter result={result} /></div>,
    <div><span className="section-label">09 · ARCHITECTURE & TECH STACK</span><h2>Small browser app, transparent sources</h2><div className="architecture-layout"><ArchitectureDiagram /><div><TechStack /><p className="tech-note">Plus NASA POWER, NASA GIBS, GitHub Pages, and optional Gemini explanation.</p></div></div></div>,
    <div><span className="section-label">10 · TRUST, ACCESS & RESPONSIBLE AI</span><h2>Trust is visible, access is designed in</h2><div className="trust-layout"><div className="provenance"><strong><ShieldCheck size={22} /> Provenance panel</strong>{result ? <dl><dt>Dataset</dt><dd>{result.dataset_id} · {result.dataset_version}</dd><dt>Retrieved</dt><dd>{result.provenance.access_date}</dd><dt>Origin</dt><dd>{result.provenance.data_origin}</dd><dt>Raw SHA-256</dt><dd className="mono">{result.provenance.raw_sha256}</dd></dl> : <EmptyState />}</div><CardGrid columns={3} cards={[{ Icon: Terminal, title: "Deterministic statistics", body: "AI never computes the displayed result.", tone: "teal" }, { Icon: ShieldCheck, title: "Optional Gemini", body: "Visitor-owned runtime key; never displayed or stored.", tone: "orange" }, { Icon: Globe2, title: `${LANGUAGES.length} languages + mobile`, body: "Plain-language access across devices.", tone: "blue" }]} /></div><p className="footnote">NASA POWER is a coarse (~50 km) model-based grid, not a city-level measurement.</p></div>,
    <div><span className="section-label">11 · FUTURE SCOPE</span><h2>Planned, not built</h2><CardGrid columns={4} cards={[{ Icon: Waves, title: "More NASA datasets", body: "IMERG rainfall, soil moisture, vegetation.", tone: "teal" }, { Icon: Target, title: "Finer validation", body: "Higher resolution and ground-station checks.", tone: "orange" }, { Icon: Users, title: "Classroom mode", body: "Guided lessons and exportable reports.", tone: "blue" }, { Icon: Globe2, title: "More access", body: "Additional languages and offline packs.", tone: "teal" }]} /></div>,
    <div className="closing-slide"><span className="section-label">12 · CONCLUSION</span><h2>What changed, how sure are we, and what can we honestly say?</h2><p>TERRASCAN turns NASA data into a careful local question.</p><div className="takeaway-row"><span><Check size={17} /> Real NASA data</span><span><Check size={17} /> Tested trends</span><span><Check size={17} /> Honest limits</span></div><div className="qr-box"><span>QR</span><small>{window.location.origin}{import.meta.env.BASE_URL}#/present</small></div><p className="live-url">{window.location.origin}{import.meta.env.BASE_URL}</p><button className="present-cta" onClick={exit}>Thank you / Questions <RotateCcw size={18} /></button><p className="team-line">{TEAM.map((member) => `${member.name} · ${member.role} · ${member.username}`).join("  |  ")}</p></div>,
  ], [result]);
  const next = () => setSlide((value) => Math.min(slides.length - 1, value + 1));
  const previous = () => setSlide((value) => Math.max(0, value - 1));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") { event.preventDefault(); next(); }
      else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); previous(); }
      else if (event.key === "Escape") exit();
      else if (event.key.toLowerCase() === "f") stageRef.current?.requestFullscreen?.();
      else if (/^[1-9]$/.test(event.key)) setSlide(Math.min(slides.length - 1, Number(event.key) - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <div className="present-stage" ref={stageRef} tabIndex={-1} onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(delta) > 48) (delta < 0 ? next : previous)(); touchStart.current = null; }}>
    <div className="mesh mesh--one" /><div className="mesh mesh--two" /><div className="present-top"><span className="counter-chip"><span>0{Math.min(slide + 1, 9)}</span> / {slides.length}</span><div><button className="present-icon" aria-label="Previous slide" onClick={previous}><ArrowLeft size={18} /></button><button className="present-icon" aria-label="Next slide" onClick={next}><ArrowRight size={18} /></button><button className="present-icon" aria-label="Enter fullscreen" onClick={() => stageRef.current?.requestFullscreen?.()}><Maximize size={18} /></button><button className="present-exit" onClick={exit}>Exit deck</button></div></div>
    <div className="present-progress" aria-hidden="true"><i style={{ width: `${((slide + 1) / slides.length) * 100}%` }} /></div>
    <div className="present-frame"><SlideBoundary key={slide} onExit={exit}><section className="present-slide">{slides[slide]}</section></SlideBoundary></div>
    <div className="present-bottom"><div className="present-dots" role="tablist" aria-label="Slides">{slides.map((_, index) => <button key={index} role="tab" aria-label={`Go to slide ${index + 1}`} aria-selected={slide === index} className={slide === index ? "is-on" : ""} onClick={() => setSlide(index)} />)}</div><span><ArrowLeft size={14} /> arrows / space · F fullscreen · Esc exit</span></div>
  </div>;
}

export default Present;
