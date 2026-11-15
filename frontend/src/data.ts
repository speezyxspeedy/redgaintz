import { useEffect, useState } from "react";
import { fetchPowerPoint, parsePowerMonthly, type PowerMeta } from "./lib/power";
import { withPrettyUnits } from "./lib/analysis";
import type { MonthlySeries } from "./lib/sciTypes";
import { rulesFor, VARIABLES } from "./lib/variables";
import type { Place } from "./theme";
import bundled from "./lib/__fixtures__/power_nagpur_monthly.json";

export const LAST_COMPLETE_YEAR = new Date().getFullYear() - 1;
export const FIRST_YEAR = 1981;

export interface SeriesState {
  status: "loading" | "ready" | "error";
  series: Record<string, MonthlySeries>;
  meta: PowerMeta | null;
  /** Variables that could not be fetched (id -> message). */
  missing: Record<string, string>;
  error: string | null;
  /** true when the numbers come from the snapshot shipped with the app because the network call failed. */
  offlineSnapshot: boolean;
}

const EMPTY: SeriesState = { status: "loading", series: {}, meta: null, missing: {}, error: null, offlineSnapshot: false };

const CORE = VARIABLES.filter((v) => v.verified !== false).map((v) => v.id);
const EXTRA = VARIABLES.filter((v) => v.verified === false).map((v) => v.id);

const isNagpur = (p: Place) => Math.abs(p.lat - 21.1458) < 0.05 && Math.abs(p.lon - 79.0882) < 0.05;

export function bundledSnapshot(): { series: Record<string, MonthlySeries>; meta: PowerMeta } {
  const ids = Object.keys((bundled as { properties: { parameter: object } }).properties.parameter);
  const data = parsePowerMonthly(bundled, rulesFor(ids), {
    source_url: "Saved NASA POWER response shipped with the app (Nagpur)",
    retrieved_utc: "",
    origin: "cached",
    requested: { lat: 21.1458, lon: 79.0882 },
  });
  return { series: data.series, meta: data.meta };
}

/** Loads every variable for one place with at most two NASA POWER requests (cached in the browser). */
export function useSeries(place: Place): SeriesState {
  const [state, setState] = useState<SeriesState>(EMPTY);

  useEffect(() => {
    const controller = new AbortController();
    setState({ ...EMPTY });
    const base = { lat: place.lat, lon: place.lon, startYear: FIRST_YEAR, endYear: LAST_COMPLETE_YEAR };

    (async () => {
      let series: Record<string, MonthlySeries> = {};
      let meta: PowerMeta | null = null;
      let offline = false;
      const missing: Record<string, string> = {};
      try {
        const core = await fetchPowerPoint({ ...base, parameters: CORE }, rulesFor(CORE), { signal: controller.signal });
        series = core.series;
        meta = core.meta;
      } catch (e) {
        if (controller.signal.aborted) return;
        if (isNagpur(place)) {
          const snap = bundledSnapshot();
          series = snap.series;
          meta = snap.meta;
          offline = true;
        } else {
          setState({ ...EMPTY, status: "error", error: e instanceof Error ? e.message : "Could not load NASA POWER data." });
          return;
        }
      }
      const show = (extraSeries: Record<string, MonthlySeries>) => {
        const all = Object.fromEntries(Object.entries({ ...series, ...extraSeries }).map(([k, v]) => [k, withPrettyUnits(v)]));
        setState({ status: "ready", series: all, meta, missing, error: null, offlineSnapshot: offline });
      };
      show({});
      if (offline) {
        EXTRA.forEach((id) => (missing[id] = "Needs a live NASA POWER connection."));
        show({});
        return;
      }
      try {
        const extra = await fetchPowerPoint({ ...base, parameters: EXTRA }, rulesFor(EXTRA), { signal: controller.signal });
        series = { ...series, ...extra.series };
        show({});
      } catch (e) {
        if (controller.signal.aborted) return;
        EXTRA.forEach((id) => (missing[id] = e instanceof Error ? e.message : "Not available."));
        show({});
      }
    })();
    return () => controller.abort();
  }, [place.lat, place.lon]);

  return state;
}
