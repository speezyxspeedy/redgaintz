import { describe, expect, it } from "vitest";
import { aggregate, daysInMonth } from "../aggregate";
import type { MonthlySeries } from "../sciTypes";

function makeSeries(
  rule: MonthlySeries["rule"],
  units: string,
  valueFor: (year: number, month: number) => number | null,
  from = 2000,
  to = 2005,
): MonthlySeries {
  const series = [];
  for (let year = from; year <= to; year++) {
    for (let month = 1; month <= 12; month++) series.push({ year, month, value: valueFor(year, month) });
  }
  return { variable_id: "X", name: "test", units, rule, series };
}

describe("daysInMonth", () => {
  it("handles leap years", () => {
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2001, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2024, 12)).toBe(31);
  });
});

describe("annual view", () => {
  it("rainfall: 1 mm/day all year = 365 mm (366 in a leap year)", () => {
    const s = makeSeries("sum_of_daily_rate", "mm/day", () => 1);
    const r = aggregate(s, { kind: "annual" }, { startYear: 2000, endYear: 2001 });
    expect(r.values).toEqual([366, 365]);
    expect(r.units).toBe("mm");
  });

  it("temperature: day-weighted mean of months 1..12 in 2001 = 2382/365", () => {
    // hand calc: 31*1+28*2+31*3+30*4+31*5+30*6+31*7+31*8+30*9+31*10+30*11+31*12 = 2382
    const s = makeSeries("mean", "C", (_y, m) => m);
    const r = aggregate(s, { kind: "annual" }, { startYear: 2001, endYear: 2001 });
    expect(r.values[0]).toBeCloseTo(2382 / 365, 10);
    expect(r.units).toBe("C");
  });

  it("skips years with a missing month and says which", () => {
    const s = makeSeries("mean", "C", (y, m) => (y === 2002 && m === 7 ? null : 20));
    const r = aggregate(s, { kind: "annual" }, { startYear: 2000, endYear: 2003 });
    expect(r.values).toEqual([20, 20, null, 20]);
    expect(r.yearsUsed).toEqual([2000, 2001, 2003]);
    expect(r.yearsSkipped).toEqual([{ year: 2002, reason: "missing monthly value: Jul" }]);
  });

  it("only returns years inside the requested range", () => {
    const s = makeSeries("mean", "C", () => 1);
    const r = aggregate(s, { kind: "annual" }, { startYear: 2002, endYear: 2004 });
    expect(r.years).toEqual([2002, 2003, 2004]);
  });

  it("treats years outside the data as skipped, not zero", () => {
    const s = makeSeries("mean", "C", () => 1, 2000, 2002);
    const r = aggregate(s, { kind: "annual" }, { startYear: 2001, endYear: 2004 });
    expect(r.values).toEqual([1, 1, null, null]);
  });
});

describe("season and single-month views", () => {
  it("monsoon rainfall JJAS = sum of rate x days", () => {
    const s = makeSeries("sum_of_daily_rate", "mm/day", (_y, m) => (m === 6 ? 2 : m === 7 ? 10 : m === 8 ? 5 : m === 9 ? 1 : 0));
    const r = aggregate(s, { kind: "season", seasonId: "monsoon" }, { startYear: 2001, endYear: 2001 });
    expect(r.values[0]).toBeCloseTo(2 * 30 + 10 * 31 + 5 * 31 + 1 * 30, 10); // 555
    expect(r.label).toContain("Monsoon");
  });

  it("winter (Dec-Feb) uses the previous December", () => {
    const s = makeSeries("mean", "C", (y, m) => (m === 12 ? y * 1 : m === 1 || m === 2 ? 100 : 0), 2000, 2003);
    const r = aggregate(s, { kind: "season", seasonId: "winter" }, { startYear: 2001, endYear: 2002 });
    // winter 2001 = Dec 2000 (2000), Jan 2001, Feb 2001 (100 each); days 31, 31, 28
    expect(r.values[0]).toBeCloseTo((2000 * 31 + 100 * 31 + 100 * 28) / 90, 10);
  });

  it("winter of the first data year is skipped (no previous December)", () => {
    const s = makeSeries("mean", "C", () => 5, 2000, 2003);
    const r = aggregate(s, { kind: "season", seasonId: "winter" }, { startYear: 2000, endYear: 2001 });
    expect(r.values[0]).toBeNull();
    expect(r.values[1]).toBe(5);
  });

  it("single month: rainfall gives the monthly total", () => {
    const s = makeSeries("sum_of_daily_rate", "mm/day", (_y, m) => m);
    const r = aggregate(s, { kind: "month", month: 2 }, { startYear: 2000, endYear: 2001 });
    expect(r.values).toEqual([2 * 29, 2 * 28]);
  });

  it("rejects bad input", () => {
    const s = makeSeries("mean", "C", () => 1);
    expect(() => aggregate(s, { kind: "month", month: 13 }, { startYear: 2000, endYear: 2001 })).toThrow();
    expect(() => aggregate(s, { kind: "season", seasonId: "nope" }, { startYear: 2000, endYear: 2001 })).toThrow();
    expect(() => aggregate(s, { kind: "annual" }, { startYear: 2005, endYear: 2000 })).toThrow();
  });

  it("ignores any point with month 13", () => {
    const s = makeSeries("mean", "C", () => 1);
    s.series.push({ year: 2001, month: 13, value: 999 });
    const r = aggregate(s, { kind: "annual" }, { startYear: 2001, endYear: 2001 });
    expect(r.values[0]).toBe(1);
  });
});

describe("anomaly view", () => {
  it("removes a pure seasonal cycle completely", () => {
    const s = makeSeries("mean", "C", (_y, m) => 20 + 5 * Math.sin((m / 12) * 2 * Math.PI));
    const r = aggregate(s, { kind: "anomaly" }, { startYear: 2000, endYear: 2005 });
    for (const v of r.values) expect(Math.abs(v as number)).toBeLessThan(1e-12);
  });

  it("keeps a real warming signal: +0.1 per year survives", () => {
    const s = makeSeries("mean", "C", (y, m) => 20 + m + 0.1 * (y - 2000));
    const r = aggregate(s, { kind: "anomaly" }, { startYear: 2000, endYear: 2005 });
    const vals = r.values as number[];
    expect(vals[1] - vals[0]).toBeCloseTo(0.1, 10);
    expect(vals[5] - vals[0]).toBeCloseTo(0.5, 10);
    expect(vals.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10); // anomalies average to zero
  });

  it("skips incomplete years", () => {
    const s = makeSeries("mean", "C", (y, m) => (y === 2003 && m === 1 ? null : 10));
    const r = aggregate(s, { kind: "anomaly" }, { startYear: 2000, endYear: 2005 });
    expect(r.values[3]).toBeNull();
    expect(r.yearsSkipped[0].year).toBe(2003);
  });
});
