import { VIDARBHA_DISTRICTS_DATA } from "./districtData";
import type { ViewSpec } from "./lib/sciTypes";

/** One signature colour pair per variable. Colour never carries meaning alone: every chart also labels and styles lines. */
export const ACCENTS: Record<string, { a: string; b: string; icon: string }> = {
  PRECTOTCORR: { a: "#38bdf8", b: "#6366f1", icon: "droplets" },
  T2M: { a: "#fb923c", b: "#f43f5e", icon: "thermo" },
  T2M_MAX: { a: "#f43f5e", b: "#f59e0b", icon: "flame" },
  T2M_MIN: { a: "#818cf8", b: "#22d3ee", icon: "moon" },
  RH2M: { a: "#2dd4bf", b: "#38bdf8", icon: "cloud" },
  WS10M: { a: "#a78bfa", b: "#e879f9", icon: "wind" },
  ALLSKY_SFC_SW_DWN: { a: "#facc15", b: "#fb923c", icon: "sun" },
};
export const FALLBACK_ACCENT = { a: "#22d3ee", b: "#8b5cf6", icon: "activity" };
export const accentFor = (id: string) => ACCENTS[id] ?? FALLBACK_ACCENT;

export interface Place {
  id: string;
  label: string;
  sub: string;
  lat: number;
  lon: number;
  kind: "region" | "district" | "world" | "custom";
  /** Only set for Vidarbha regions/districts: used to drive the globe. */
  regionId?: string;
}

const districts = Object.values(VIDARBHA_DISTRICTS_DATA);
const vidLat = districts.reduce((s, d) => s + d.centroid.lat, 0) / districts.length;
const vidLon = districts.reduce((s, d) => s + d.centroid.lng, 0) / districts.length;

export const VIDARBHA_PLACE: Place = {
  id: "IN-MH-VID",
  label: "Vidarbha",
  sub: "Centre of the region",
  lat: Math.round(vidLat * 1e4) / 1e4,
  lon: Math.round(vidLon * 1e4) / 1e4,
  kind: "region",
  regionId: "IN-MH-VID",
};

export const DISTRICT_PLACES: Place[] = districts.map((d) => ({
  id: d.id,
  label: d.name,
  sub: `${d.division} division`,
  lat: d.centroid.lat,
  lon: d.centroid.lng,
  kind: "district" as const,
  regionId: d.id,
}));

export const WORLD_PLACES: Place[] = [
  { id: "thar", label: "Thar Desert", sub: "Rajasthan, India", lat: 26.9, lon: 70.9, kind: "world" },
  { id: "amazon", label: "Amazon rainforest", sub: "Brazil", lat: -3.1, lon: -60.0, kind: "world" },
  { id: "sundarbans", label: "Sundarbans delta", sub: "Bangladesh / India", lat: 21.95, lon: 89.18, kind: "world" },
  { id: "delhi", label: "Delhi", sub: "Large city", lat: 28.61, lon: 77.21, kind: "world" },
  { id: "greenland", label: "Greenland interior", sub: "Arctic ice sheet", lat: 72.5, lon: -40.0, kind: "world" },
];

export const ALL_PLACES: Place[] = [VIDARBHA_PLACE, ...DISTRICT_PLACES, ...WORLD_PLACES];

export function findPlace(id: string): Place | undefined {
  return ALL_PLACES.find((p) => p.id === id);
}

export function customPlace(lat: number, lon: number): Place {
  return {
    id: "custom",
    label: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
    sub: "Your chosen point",
    lat,
    lon,
    kind: "custom",
  };
}

export interface Demo {
  id: string;
  title: string;
  question: string;
  variable: string;
  placeId: string;
  view: ViewSpec;
  start: number;
  end: number;
  look: string;
}

/** Demos only set the controls. They never say what the data will show. */
export const DEMOS: Demo[] = [
  {
    id: "monsoon",
    title: "Monsoon rain over Nagpur",
    question: "Is the monsoon getting wetter or drier?",
    variable: "PRECTOTCORR",
    placeId: "IN-MH-VID-NAG",
    view: { kind: "season", seasonId: "monsoon" },
    start: 1981,
    end: 2025,
    look: "Rain is very uneven from year to year. Check whether the trend line sits clearly outside that noise.",
  },
  {
    id: "temperature",
    title: "Air temperature in Vidarbha",
    question: "Is the air getting warmer once the seasons are removed?",
    variable: "T2M",
    placeId: "IN-MH-VID",
    view: { kind: "anomaly" },
    start: 1981,
    end: 2025,
    look: "The anomaly view subtracts the usual seasonal cycle so slow changes are easier to see.",
  },
  {
    id: "humidity",
    title: "Humidity in Nagpur",
    question: "Is the air holding more or less water vapour?",
    variable: "RH2M",
    placeId: "IN-MH-VID-NAG",
    view: { kind: "annual" },
    start: 1981,
    end: 2025,
    look: "Relative humidity depends on temperature, so read it together with the temperature result.",
  },
  {
    id: "solar",
    title: "Sunshine over the Thar Desert",
    question: "Is a cloud-free desert getting more or less sunlight?",
    variable: "ALLSKY_SFC_SW_DWN",
    placeId: "thar",
    view: { kind: "annual" },
    start: 1981,
    end: 2025,
    look: "Compare how big the change is with the average. A tiny change can still be statistically significant.",
  },
];

export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  long: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { id: "trend", term: "Trend", short: "A steady drift upward or downward over many years.", long: "A trend is a change that keeps pointing the same way over time, as opposed to ordinary ups and downs from one year to the next." },
  { id: "significant", term: "Statistically significant", short: "A change too steady to be explained by normal year-to-year luck.", long: "Scientists call a trend significant when random ups and downs alone would rarely produce a pattern this consistent. It says nothing about how big or how important the change is." },
  { id: "p-value", term: "p-value", short: "The chance of seeing a pattern this strong if there were no real trend.", long: "A small p-value (below 0.05 here) means a trend this clear would be unlikely by chance alone. A large p-value does not prove there is no trend; it only means the data are not strong enough to show one." },
  { id: "sen", term: "Sen's slope", short: "The typical yearly change, robust to a few odd years.", long: "Sen's slope takes the change between every pair of years and picks the middle value, so a few extreme years do not drag it around." },
  { id: "mk", term: "Mann–Kendall test", short: "A test that counts how often later years are higher than earlier ones.", long: "If later years are mostly higher (or mostly lower) than earlier years far more often than chance would allow, the test reports a significant trend. It does not assume the data follow a bell curve." },
  { id: "ci", term: "95% confidence range", short: "The range the true yearly change probably lies in.", long: "If the whole range is above zero (or below zero), the data point clearly in one direction. If it spans zero, the direction is uncertain." },
  { id: "ols", term: "Straight-line fit (OLS)", short: "The ordinary best-fit line through the yearly values.", long: "Ordinary least squares draws the line that is closest to all points in a squared-error sense. It is more affected by extreme years than Sen's slope." },
  { id: "anomaly", term: "Anomaly", short: "How far a value is from the usual value for that month.", long: "Subtracting each calendar month's long-term average removes the seasonal cycle, so a slow warming or drying stands out." },
  { id: "autocorr", term: "Autocorrelation", short: "When one year tends to resemble the year before.", long: "If neighbouring years are similar, the data hold less independent information than they seem to, and a p-value can look more convincing than it deserves." },
  { id: "grid", term: "Grid cell", short: "A box about 50 km wide where the model gives one value.", long: "NASA POWER's MERRA-2 estimates describe a whole box, not a single spot, so small features such as a city or a lake do not show up." },
];

export const glossaryById = (id: string) => GLOSSARY.find((g) => g.id === id);
