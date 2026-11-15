import { Compass, Crosshair, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Cartesian3, Cartographic, Color, GeoJsonDataSource, ImageryLayer, Math as CMath, SceneMode, ScreenSpaceEventHandler, ScreenSpaceEventType, UrlTemplateImageryProvider, Viewer } from "cesium";
import { go } from "../components";

const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services";
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const BASES = {
  satellite: { name: "Satellite", url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, max: 19, credit: "Esri, Maxar, Earthstar Geographics" },
  bluemarble: { name: "NASA Blue Marble", url: `${GIBS}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`, max: 8, credit: "NASA GIBS" },
  dark: { name: "Dark map", url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, max: 16, credit: "Esri" },
} as const;
const OVERLAYS = [
  { id: "none", name: "No overlay" },
  { id: "truecolor", name: "True colour, VIIRS", layer: "VIIRS_SNPP_CorrectedReflectance_TrueColor", level: 9, ext: "jpg" },
  { id: "imerg", name: "Rain rate, GPM IMERG", layer: "IMERG_Precipitation_Rate", level: 6, ext: "png" },
  { id: "lst", name: "Land surface temperature, MODIS", layer: "MODIS_Terra_Land_Surface_Temp_Day", level: 7, ext: "png" },
  { id: "ndvi", name: "Vegetation greenness, MODIS NDVI", layer: "MODIS_Terra_NDVI_8Day", level: 9, ext: "png" },
] as const;
type BaseId = keyof typeof BASES;
type Mode = "globe" | "tilt" | "map";

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const prov = (url: string, max: number, credit: string) => new UrlTemplateImageryProvider({ url, maximumLevel: max, credit });

export default function Explore() {
  const box = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const baseLayer = useRef<ImageryLayer | null>(null);
  const overLayer = useRef<ImageryLayer | null>(null);
  const [base, setBase] = useState<BaseId>("satellite");
  const [over, setOver] = useState<(typeof OVERLAYS)[number]["id"]>("none");
  const [date, setDate] = useState(isoDaysAgo(3));
  const [alpha, setAlpha] = useState(0.75);
  const [mode, setMode] = useState<Mode>("globe");
  const [pick, setPick] = useState<{ lat: number; lon: number } | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const v = new Viewer(box.current!, { animation: false, baseLayerPicker: false, baseLayer: false, geocoder: false, homeButton: false, infoBox: false, navigationHelpButton: false, sceneModePicker: false, selectionIndicator: false, timeline: false, fullscreenButton: false, scene3DOnly: false });
    viewer.current = v;
    v.scene.globe.enableLighting = false;
    v.scene.globe.showGroundAtmosphere = true;
    v.scene.backgroundColor = Color.fromCssColorString("#03090f");
    v.camera.setView({ destination: Cartesian3.fromDegrees(70, 12, 2.6e7) });
    GeoJsonDataSource.load(`${import.meta.env.BASE_URL}boundaries/IN-MH-VID.display.geojson`, { stroke: Color.fromCssColorString("#ff8a1f"), strokeWidth: 2, fill: Color.fromCssColorString("#ff8a1f").withAlpha(0.1) }).then((d) => { v.dataSources.add(d); }).catch(() => {});
    const h = new ScreenSpaceEventHandler(v.scene.canvas);
    h.setInputAction((e: { position: any }) => {
      const c = v.camera.pickEllipsoid(e.position, v.scene.globe.ellipsoid);
      if (!c) return;
      const g = Cartographic.fromCartesian(c);
      setPick({ lat: CMath.toDegrees(g.latitude), lon: CMath.toDegrees(g.longitude) });
    }, ScreenSpaceEventType.LEFT_CLICK);
    return () => { h.destroy(); if (!v.isDestroyed()) v.destroy(); };
  }, []);

  useEffect(() => {
    const v = viewer.current; if (!v) return;
    if (baseLayer.current) v.imageryLayers.remove(baseLayer.current);
    const b = BASES[base];
    baseLayer.current = v.imageryLayers.addImageryProvider(prov(b.url, b.max, b.credit), 0);
  }, [base]);

  useEffect(() => {
    const v = viewer.current; if (!v) return;
    if (overLayer.current) { v.imageryLayers.remove(overLayer.current); overLayer.current = null; }
    const o = OVERLAYS.find((x) => x.id === over);
    if (!o || !("layer" in o)) { setMsg(""); return; }
    const p = prov(`${GIBS}/${o.layer}/default/${date}/GoogleMapsCompatible_Level${o.level}/{z}/{y}/{x}.${o.ext}`, o.level, "NASA GIBS");
    let bad = 0;
    p.errorEvent.addEventListener(() => { if (++bad === 6) setMsg(`No ${o.name} tiles for ${date}. Try an earlier date.`); });
    setMsg("");
    overLayer.current = v.imageryLayers.addImageryProvider(p);
    overLayer.current.alpha = alpha;
  }, [over, date]);

  useEffect(() => { if (overLayer.current) overLayer.current.alpha = alpha; }, [alpha]);

  const fly = (lon: number, lat: number, h: number, pitch = -90) => viewer.current?.camera.flyTo({ destination: Cartesian3.fromDegrees(lon, lat, h), orientation: { heading: 0, pitch: CMath.toRadians(pitch), roll: 0 }, duration: 1.6 });
  const setView = (m: Mode) => {
    const v = viewer.current; if (!v) return;
    setMode(m);
    if (m === "map") { v.scene.morphTo2D(1); return; }
    const at = pick ?? { lat: 20.9, lon: 78.6 };
    const go3d = () => (m === "tilt" ? fly(at.lon, at.lat - 2.2, 9e5, -35) : fly(70, 12, 2.6e7));
    if (v.scene.mode !== SceneMode.SCENE3D) { v.scene.morphTo3D(0.8); setTimeout(go3d, 900); } else go3d();
  };
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    try {
      const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(q.trim())}`)).json();
      const hit = r.results?.[0];
      if (!hit) { setMsg(`No place called "${q}". Try a city or district name.`); return; }
      setMsg(""); setPick({ lat: hit.latitude, lon: hit.longitude }); fly(hit.longitude, hit.latitude, 4e5);
    } catch { setMsg("Search needs a network connection."); }
  };

  return (
    <div className="xp">
      <div className="xp-canvas" ref={box} aria-label="Interactive globe. Click anywhere to choose a place." />
      <div className="xp-panel">
        <form onSubmit={search} className="xp-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a city or district" aria-label="Find a place" />
        </form>
        <fieldset>
          <legend>View</legend>
          <div className="xp-seg">
            {([["globe", "3D globe"], ["tilt", "Tilted"], ["map", "Flat map"]] as const).map(([id, l]) => <button key={id} aria-pressed={mode === id} onClick={() => setView(id)}>{l}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>Base map</legend>
          <div className="xp-seg">
            {(Object.keys(BASES) as BaseId[]).map((id) => <button key={id} aria-pressed={base === id} onClick={() => setBase(id)}>{BASES[id].name}</button>)}
          </div>
        </fieldset>
        <fieldset>
          <legend>NASA overlay</legend>
          <select value={over} onChange={(e) => setOver(e.target.value as typeof over)} aria-label="NASA overlay">
            {OVERLAYS.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {over !== "none" && (
            <div className="xp-row">
              <label>Date <input type="date" value={date} max={isoDaysAgo(1)} onChange={(e) => setDate(e.target.value)} /></label>
              <label>Opacity <input type="range" min="0.2" max="1" step="0.05" value={alpha} onChange={(e) => setAlpha(+e.target.value)} /></label>
            </div>
          )}
        </fieldset>
        <button className="btn" onClick={() => { setMode("globe"); fly(78.6, 20.9, 9e5); }}><Crosshair size={14} aria-hidden="true" /> Fly to Vidarbha</button>
        {msg && <p className="xp-msg" role="status">{msg}</p>}
      </div>
      <div className="xp-pick" aria-live="polite">
        {pick ? (<>
          <strong>{pick.lat.toFixed(3)}°, {pick.lon.toFixed(3)}°</strong>
          <span>NASA POWER returns one value per grid cell here (about 50 km wide).</span>
          <button className="btn btn--primary" onClick={() => go("/investigate", { p: "custom", lat: pick.lat.toFixed(3), lon: pick.lon.toFixed(3) })}><Compass size={14} aria-hidden="true" /> Investigate this point</button>
        </>) : <span>Click anywhere on Earth to pick a place.</span>}
      </div>
    </div>
  );
}
