import { Bot, ExternalLink, Database, FlaskConical, ShieldAlert } from "lucide-react";
import { Refs } from "../Lineage";
import { VARIABLES } from "../lib/variables";
import { getCopy, type Language } from "../i18n";

type Status = "Live" | "Link" | "Reference";
const SOURCES: [string, string, string, string, Status][] = [
  ["NASA POWER (MERRA-2)", "https://power.larc.nasa.gov/", "Monthly rain, temperature, humidity, wind and sunshine from 1981", "All trend, probability and change-point results", "Live"],
  ["NASA GIBS", "https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api", "Daily satellite imagery layers", "Globe overlays: true colour, rain rate, land temperature, vegetation", "Live"],
  ["Giovanni", "https://giovanni.gsfc.nasa.gov/", "Time series and maps of many NASA variables", "Cross-check a result; needs an Earthdata login", "Link"],
  ["Hydrology Time Series", "https://disc.gsfc.nasa.gov/information/tools?title=Hydrology%20Time%20Series", "Time series of hydrological data", "Cross-check soil water and runoff", "Link"],
  ["AppEEARS", "https://appeears.earthdatacloud.nasa.gov/", "Point and area extracts from federal archives", "Pull a satellite series for the same place; needs a login", "Link"],
  ["NOAA Climate Data Online", "https://www.ncei.noaa.gov/cdo-web/", "Weather station records", "Compare a grid result with a nearby station", "Link"],
  ["KNMI Climate Explorer", "https://climexp.knmi.nl/", "Climate data analysis in the browser", "Independent check of a trend", "Link"],
  ["SWOT mission", "https://www.asc-csa.gc.ca/eng/satellites/swot/", "Water surface height of lakes, rivers and reservoirs", "Future water-level trends; not integrated", "Reference"],
  ["RADARSAT Constellation Mission", "https://donnees-data.asc-csa.gc.ca/en/dataset/rcm", "All-weather radar imagery", "Flood and crop monitoring; not integrated", "Reference"],
  ["Geo.ca", "http://geo.ca/", "Canadian open geospatial data", "Outside the Vidarbha study area", "Reference"],
  ["SAR Python tutorial", "https://github.com/asc-csa/Synthetic_Aperture_Radar_Tutorial", "How to read SAR imagery in Python and QGIS", "Background for future radar work", "Reference"],
  ["Chlorophyll time-series paper", "https://ntrs.nasa.gov/api/citations/20090042747/downloads/20090042747.pdf", "Worked example of time series and significance tests", "Method reference", "Reference"],
  ["Trend-test and significance guides", "https://www.statsig.com/perspectives/a-comprehensive-guide-to-statistical-significance", "Plain explanations of trend tests and p-values", "Method reference", "Reference"],
];

export default function About({ language = "en" }: { language?: Language }) {
  const copy = getCopy(language);
  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow"><Database size={14} aria-hidden="true" /> {copy.site.aboutEyebrow}</span>
        <h1>{copy.site.aboutTitle}</h1>
        <p className="lede">{copy.site.aboutIntro}</p>
      </header>

      <section className="band two-col">
        <div className="card">
          <h3><Database size={18} aria-hidden="true" /> {copy.site.data}</h3>
          <p>NASA POWER monthly point data (API v2.10.0), built mostly from the MERRA-2 reanalysis, 1981 to the last complete year. Each answer describes one grid cell about 50 km wide. Requests are cached in your browser for seven days and labelled <em>Live</em> or <em>Cached</em>.</p>
          <p>Nagpur also has a saved snapshot of a real NASA POWER response so the app still works without a connection.</p>
        </div>
        <div className="card">
          <h3><FlaskConical size={18} aria-hidden="true" /> {copy.site.statistics}</h3>
          <p>Yearly values are built from the monthly values: rainfall adds up daily rates over the days in each month, everything else is a day-weighted average. Years with any missing month are skipped.</p>
          <p>Trend: Mann–Kendall (tie-corrected) for significance, Sen's slope with a 95% range for size, ordinary least squares and a lag-1 autocorrelation check as cross-checks. The TypeScript code is tested against the project's Python implementation.</p>
        </div>
      </section>

      <section className="band" aria-labelledby="src">
        <h2 id="src">{copy.site.sources}</h2>
        <p className="hint">Status says exactly what TERRASCAN does with each one. Nothing marked Reference or Cross-check is used in a result.</p>
        <div className="table-wrap">
          <table className="table src-table">
            <thead><tr><th>Resource</th><th>What it provides</th><th>Use in TERRASCAN</th><th>Status</th></tr></thead>
            <tbody>
              {SOURCES.map(([name, url, what, use, status]) => (
                <tr key={name}>
                  <th scope="row"><a href={url} target="_blank" rel="noopener noreferrer">{name} <ExternalLink size={12} aria-hidden="true" /></a></th>
                  <td>{what}</td><td>{use}</td><td><span className={`pill pill--${status.toLowerCase()}`}>{status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band two-col" aria-labelledby="priv">
        <div className="card">
          <h3 id="priv"><ShieldAlert size={18} aria-hidden="true" /> {copy.site.privacy}</h3>
          <p>There are no accounts and no analytics. The coordinates you choose go to NASA POWER, and place searches go to the Open-Meteo geocoder. Map tiles come from NASA GIBS and Esri.</p>
          <p>The assistant works offline by default. If you add your own Gemini key it is kept for this browser tab only, and your questions then go to Google.</p>
        </div>
        <div className="card">
          <h3><FlaskConical size={18} aria-hidden="true" /> {copy.site.limits}</h3>
          <p>POWER describes a grid cell about 50 km wide, so it cannot see a city, a lake or a single farm. A significant trend is not a cause, and "no significant trend" is a valid result.</p>
          <p>Probabilities assume future years scatter around the fitted line as past years did. They are not weather forecasts.</p>
        </div>
      </section>

      <section className="band" aria-labelledby="refs">
        <h2 id="refs">{copy.site.references}</h2>
        <p className="hint">Numbers in square brackets across the app point to these sources.</p>
        <Refs ids={[1, 2, 3, 4, 5, 6, 7, 8]} />
      </section>

      <section className="band" aria-labelledby="vars">
        <h2 id="vars">{copy.site.variables}</h2>
        <div className="table-wrap">
          <table className="table table--vars">
            <thead><tr><th>Variable</th><th>POWER name</th><th>Yearly value</th><th>Status</th></tr></thead>
            <tbody>
              {VARIABLES.map((v) => (
                <tr key={v.id}>
                  <th scope="row">{v.short_name}</th>
                  <td className="mono">{v.id}</td>
                  <td>{v.aggregation_rule === "sum_of_daily_rate" ? "Total (mm per year or season)" : "Average"}</td>
                  <td>{v.verified === false ? "Units read from the live response; not yet checked by the team" : "Name and units confirmed in a real response"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band two-col">
        <div className="card card--warn">
          <h3><ShieldAlert size={18} aria-hidden="true" /> Limits you should know</h3>
          <ul className="plain">
            <li>Model estimates, not weather-station readings. A city or lake is smaller than a grid cell.</li>
            <li>A trend is not a cause. Finding that something changed does not say why.</li>
            <li>Linear trends only. Trends that bend, or abrupt jumps, are beyond this tool.</li>
            <li>Rainfall swings a lot between years, so short ranges often show no significant trend.</li>
            <li>The latest years in near-real-time model output can be revised by NASA.</li>
          </ul>
        </div>
        <div className="card">
          <h3><Bot size={18} aria-hidden="true" /> {copy.site.aiUse}</h3>
          <p>The numbers, charts and verdicts are produced by deterministic, tested code. They are not written by an AI.</p>
          <p>The interface redesign was written with Claude (Anthropic) through Claude Code. The optional chat assistant calls Google Gemini only if a visitor types in their own key, which stays in their browser, and it is told to explain only the numbers shown.</p>
        </div>
      </section>
    </div>
  );
}
