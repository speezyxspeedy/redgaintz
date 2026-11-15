import { ArrowRight, BarChart3, Compass, Database, Eye, FlaskConical, MapPin, Play, Scale, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import Hero3D from "../Hero3D";
import { TrendChart } from "../charts";
import { VarIcon, go } from "../components";
import { bundledSnapshot } from "../data";
import { analyse, viewToParam, withPrettyUnits } from "../lib/analysis";
import { getVariable } from "../lib/variables";
import { DEMOS, accentFor, findPlace } from "../theme";
import { getCopy, type Language } from "../i18n";

export default function Home({ language = "en" }: { language?: Language }) {
  const copy = getCopy(language);
  const preview = useMemo(() => {
    const snap = bundledSnapshot();
    const card = getVariable("PRECTOTCORR");
    return analyse(withPrettyUnits(snap.series.PRECTOTCORR), card, { kind: "season", seasonId: "monsoon" }, 1981, 2025);
  }, []);
  const ac = accentFor("PRECTOTCORR");

  return (
    <div className="home">
      <section className="hero3d">
        <Hero3D />
        <div className="hero3d-copy">
          <h1>{copy.site.homeHeadline}</h1>
          <p className="lede">{copy.site.homeIntro}</p>
          <div className="cta-row">
            <button className="btn btn--primary btn--lg" onClick={() => go("/investigate")}><Compass size={18} aria-hidden="true" /> {copy.site.investigate}</button>
            <button className="btn btn--lg" onClick={() => go("/explore")}>{copy.site.explore}</button>
          </div>
          <p className="hero3d-src">NASA POWER, MERRA-2, 1981 to {new Date().getFullYear() - 1}. Drag the Earth to turn it.</p>
        </div>
      </section>

      <section className="band atlas-cta" aria-labelledby="atlasq">
        <h2 id="atlasq">{copy.site.atlasTitle}</h2>
        <p>{copy.site.atlasText}</p>
        <button className="btn btn--primary btn--lg" onClick={() => go("/atlas")}>{copy.site.atlasButton}</button>
      </section>

      <section className="band preview-band" aria-labelledby="live">
        <h2 id="live">{copy.site.finished}</h2>
        <div className="hero-card" style={{ ["--a" as string]: ac.a, ["--b" as string]: ac.b }}>
          <div className="hero-card-head">
            <span className="var-icon"><VarIcon id="PRECTOTCORR" /></span>
            <div>
              <strong>Monsoon rain over Nagpur, 1981–2025</strong>
              <span>Computed in your browser from a saved NASA POWER response</span>
            </div>
          </div>
          <TrendChart analysis={preview} accent={ac} title="Monsoon rainfall at Nagpur" compact />
          <p className="hero-verdict">{preview.verdict?.headline}</p>
          <button className="link" onClick={() => go("/investigate", { v: "PRECTOTCORR", p: "IN-MH-VID-NAG", view: viewToParam({ kind: "season", seasonId: "monsoon" }) })}>
            Open this investigation <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="band" aria-labelledby="how">
        <h2 id="how">{copy.site.how}</h2>
        <ol className="how">
          {[
            ["Choose", "Pick a variable such as rainfall, temperature, humidity or sunshine. Each comes with a plain definition.", Eye],
            ["Locate", "Click a place on the 3D globe, choose one of 11 Vidarbha districts, or enter any latitude and longitude.", MapPin],
            ["Measure", "TERRASCAN turns 45 years of NASA monthly data into yearly values and draws the trend with its 95% range.", Database],
            ["Judge", "Mann–Kendall and Sen's slope say whether the change is significant. A plain verdict explains what it means and what it doesn't.", ShieldCheck],
          ].map(([t, d, I], i) => {
            const Icon = I as typeof Eye;
            return (
              <li key={t as string} style={{ animationDelay: `${i * 80}ms` }}>
                <span className="how-n">{i + 1}</span>
                <Icon size={22} aria-hidden="true" />
                <h3>{t as string}</h3>
                <p>{d as string}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="band" aria-labelledby="demos">
        <div className="band-head">
          <h2 id="demos">{copy.site.demos}</h2>
          <p>Each demo only sets the controls. The result is whatever the data shows, significant or not.</p>
        </div>
        <div className="demo-grid">
          {DEMOS.map((d, i) => {
            const a = accentFor(d.variable);
            return (
              <button key={d.id} className="demo-card" style={{ ["--a" as string]: a.a, ["--b" as string]: a.b, animationDelay: `${i * 70}ms` }} onClick={() => go("/investigate", { demo: d.id })}>
                <span className="var-icon var-icon--lg"><VarIcon id={d.variable} size={24} /></span>
                <h3>{d.title}</h3>
                <p>{d.question}</p>
                <span className="demo-meta">{getVariable(d.variable).short_name} · {findPlace(d.placeId)?.label} · {d.start}–{d.end}</span>
                <span className="demo-go">Watch <Play size={13} aria-hidden="true" /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="band principles" aria-labelledby="honest">
        <h2 id="honest">{copy.site.honest}</h2>
        <div className="principle-grid">
          <div><h3>Nothing is invented</h3><p>Every number comes from NASA POWER. Missing months are skipped, never filled in or smoothed.</p></div>
          <div><h3>“No trend” is a result</h3><p>Non-significant findings are shown as plainly as significant ones, with the reason.</p></div>
          <div><h3>Trend is not cause</h3><p>A trend shows that something changed, not why. Every verdict says so.</p></div>
          <div><h3>Open and checkable</h3><p>Source URL, grid cell, retrieval time and a CSV download are one click away.</p></div>
        </div>
      </section>
    </div>
  );
}
