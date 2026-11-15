import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPowerUrl, cacheKey, fetchPowerPoint, parsePowerMonthly } from "../power";
import type { StorageLike } from "../power";
import type { AggregationRule } from "../sciTypes";

const fixture = JSON.parse(
  readFileSync(new URL("../__fixtures__/power_nagpur_monthly.json", import.meta.url), "utf-8"),
) as Record<string, unknown>;

const rules: Record<string, AggregationRule> = {
  PRECTOTCORR: "sum_of_daily_rate",
  T2M: "mean",
  RH2M: "mean",
};
const req = { lat: 21.1458, lon: 79.0882, startYear: 1981, endYear: 2025, parameters: ["T2M", "PRECTOTCORR", "RH2M"] };
const info = {
  source_url: "u",
  retrieved_utc: "2026-11-15T00:00:00.000Z",
  origin: "live" as const,
  requested: { lat: 21.1458, lon: 79.0882 },
};

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function fakeFetch(body: unknown, status = 200) {
  const calls: string[] = [];
  const impl = (async (url: string) => {
    calls.push(String(url));
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => "bad request text" } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("buildPowerUrl", () => {
  it("builds the monthly point URL with sorted parameters", () => {
    const url = buildPowerUrl(req);
    expect(url).toBe(
      "https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR,RH2M,T2M&community=AG&longitude=79.0882&latitude=21.1458&start=1981&end=2025&format=JSON",
    );
  });
  it("rejects bad input", () => {
    expect(() => buildPowerUrl({ ...req, lat: 91 })).toThrow();
    expect(() => buildPowerUrl({ ...req, startYear: 1980 })).toThrow();
    expect(() => buildPowerUrl({ ...req, parameters: ["t2m;drop"] })).toThrow();
  });
});

describe("parsePowerMonthly on the real Nagpur response", () => {
  const data = parsePowerMonthly(fixture, rules, info);

  it("returns 45 years x 12 months per variable and no month 13", () => {
    for (const id of Object.keys(rules)) {
      const s = data.series[id].series;
      expect(s.length).toBe(45 * 12);
      expect(s.every((p) => p.month >= 1 && p.month <= 12)).toBe(true);
      expect(s[0].year).toBe(1981);
      expect(s[s.length - 1].year).toBe(2025);
    }
  });

  it("keeps known values exactly (read from the file by hand)", () => {
    const get = (id: string, y: number, m: number) => data.series[id].series.find((p) => p.year === y && p.month === m)?.value;
    expect(get("PRECTOTCORR", 1981, 1)).toBe(1.18);
    expect(get("PRECTOTCORR", 1981, 6)).toBe(9.87);
    expect(get("PRECTOTCORR", 2025, 7)).toBe(16.71);
    expect(get("T2M", 2025, 4)).toBe(34.23);
    expect(get("RH2M", 2025, 8)).toBe(85.63);
  });

  it("carries units, grid cell and source information", () => {
    expect(data.meta.parameter_units).toEqual({ PRECTOTCORR: "mm/day", RH2M: "%", T2M: "C" });
    expect(data.series.PRECTOTCORR.units).toBe("mm/day");
    expect(data.meta.grid.lat).toBe(21.146);
    expect(data.meta.grid.lon).toBe(79.088);
    expect(data.meta.grid.elevation_m).toBe(282.6);
    expect(data.meta.api_version).toBe("v2.10.0");
    expect(data.meta.sources).toEqual(["MERRA2", "POWER"]);
    expect(data.meta.fill_value).toBe(-999);
  });
});

describe("parsePowerMonthly edge cases", () => {
  it("turns the fill value into null", () => {
    const copy = JSON.parse(JSON.stringify(fixture)) as { properties: { parameter: Record<string, Record<string, number>> } };
    copy.properties.parameter.T2M["198105"] = -999;
    const data = parsePowerMonthly(copy, rules, info);
    expect(data.series.T2M.series.find((p) => p.year === 1981 && p.month === 5)?.value).toBeNull();
    expect(data.series.T2M.series.find((p) => p.year === 1981 && p.month === 4)?.value).not.toBeNull();
  });

  it("throws when a requested variable is missing", () => {
    expect(() => parsePowerMonthly(fixture, { ...rules, WS10M: "mean" }, info)).toThrow();
  });

  it("throws on a response that is not POWER data", () => {
    expect(() => parsePowerMonthly({ hello: 1 }, rules, info)).toThrow();
    expect(() => parsePowerMonthly(null, rules, info)).toThrow();
  });
});

describe("fetchPowerPoint cache behaviour", () => {
  const t0 = new Date("2026-11-15T01:00:00.000Z");

  it("first call is live, second call is cached and does not hit the network", async () => {
    const storage = memoryStorage();
    const f = fakeFetch(fixture);
    const a = await fetchPowerPoint(req, rules, { fetchImpl: f.impl, storage, now: () => t0 });
    const b = await fetchPowerPoint(req, rules, { fetchImpl: f.impl, storage, now: () => new Date(t0.getTime() + 3600_000) });
    expect(a.meta.origin).toBe("live");
    expect(b.meta.origin).toBe("cached");
    expect(b.meta.retrieved_utc).toBe(t0.toISOString());
    expect(f.calls.length).toBe(1);
  });

  it("forceRefresh goes back to the network", async () => {
    const storage = memoryStorage();
    const f = fakeFetch(fixture);
    await fetchPowerPoint(req, rules, { fetchImpl: f.impl, storage, now: () => t0 });
    const again = await fetchPowerPoint(req, rules, { fetchImpl: f.impl, storage, now: () => t0, forceRefresh: true });
    expect(again.meta.origin).toBe("live");
    expect(f.calls.length).toBe(2);
  });

  it("ignores an expired or corrupt cache entry", async () => {
    const storage = memoryStorage();
    const f = fakeFetch(fixture);
    storage.setItem(cacheKey(req), "{not json");
    const a = await fetchPowerPoint(req, rules, { fetchImpl: f.impl, storage, now: () => t0 });
    expect(a.meta.origin).toBe("live");
    const later = new Date(t0.getTime() + 8 * 24 * 3600_000);
    const b = await fetchPowerPoint(req, rules, { fetchImpl: f.impl, storage, now: () => later });
    expect(b.meta.origin).toBe("live");
    expect(f.calls.length).toBe(2);
  });

  it("reports HTTP errors with the status code", async () => {
    const f = fakeFetch({}, 422);
    let message = "";
    try {
      await fetchPowerPoint(req, rules, { fetchImpl: f.impl, storage: null, now: () => t0 });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("422");
  });

  it("reports a network failure in plain words", async () => {
    const impl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    let message = "";
    try {
      await fetchPowerPoint(req, rules, { fetchImpl: impl, storage: null, now: () => t0 });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("Could not reach NASA POWER");
  });
});
