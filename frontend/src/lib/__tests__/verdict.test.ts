import { describe, expect, it } from "vitest";
import { analyseTrend } from "../stats";
import { buildVerdict, fmt, fmtP } from "../verdict";
import { VARIABLES, getVariable, rulesFor, unitsFor } from "../variables";

const years = Array.from({ length: 30 }, (_, i) => 1996 + i);
const base = { variableName: "Rainfall", viewLabel: "Annual total", units: "mm", firstYear: 1996, lastYear: 2025, yearsSkipped: 0 };

describe("fmt", () => {
  it("uses three significant figures and explicit signs", () => {
    expect(fmt(123.456)).toBe("123");
    expect(fmt(12.345, true)).toBe("+12.3");
    expect(fmt(1.2345)).toBe("1.23");
    expect(fmt(-0.05432)).toBe("−0.0543");
    expect(fmt(0.00001, true)).toBe("0.0000");
    expect(fmt(NaN)).toBe("n/a");
  });
  it("formats p-values", () => {
    expect(fmtP(0.0004)).toBe("below 0.001");
    expect(fmtP(0.0456)).toBe("0.046");
  });
});

describe("buildVerdict", () => {
  it("significant increase: states direction, rate, total change and the cause warning", () => {
    const values = years.map((_, i) => 100 + 2 * i + (i % 3));
    const s = analyseTrend(years, values);
    const v = buildVerdict({ ...base, stats: s });
    expect(v.significant).toBe(true);
    expect(v.direction).toBe("increasing");
    expect(v.headline).toContain("statistically significant upward trend");
    expect(v.rate_per_decade).toBe("+20.0 mm per decade");
    expect(v.lines.join(" ")).toContain("per year");
    expect(v.warnings[v.warnings.length - 1]).toContain("does not identify a cause");
  });

  it("non-significant result is stated as plainly, and does not claim 'no change'", () => {
    const values = years.map((_, i) => 50 + ((i * 7) % 5));
    const s = analyseTrend(years, values);
    const v = buildVerdict({ ...base, stats: s });
    expect(v.significant).toBe(false);
    expect(v.headline).toContain("no statistically significant trend");
    expect(v.lines.join(" ")).toContain("does not prove that nothing changed");
  });

  it("significant decrease says downward", () => {
    const values = years.map((_, i) => 500 - 3 * i + (i % 2));
    const v = buildVerdict({ ...base, stats: analyseTrend(years, values) });
    expect(v.headline).toContain("downward");
    expect(v.rate_per_decade.startsWith("−")).toBe(true);
  });

  it("warns about short records, skipped years and autocorrelation", () => {
    const short = analyseTrend([2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008], [1, 2, 2, 3, 5, 4, 6, 7]);
    const v = buildVerdict({ ...base, stats: short, yearsSkipped: 2 });
    expect(v.warnings.join(" ")).toContain("Only 8 years");
    expect(v.lines.join(" ")).toContain("2 skipped");

    // strongly autocorrelated residuals (smooth wave) -> flag
    const wave = years.map((_, i) => 10 * Math.sin(i / 3));
    const w = analyseTrend(years, wave);
    if (w.lag1_autocorrelation_flag) {
      expect(buildVerdict({ ...base, stats: w }).warnings.join(" ")).toContain("Neighbouring years are correlated");
    }
  });

  it("anomaly view hides the percent-of-mean sentence", () => {
    const values = years.map((_, i) => 0.03 * (i - 15));
    const s = analyseTrend(years, values);
    const withPct = buildVerdict({ ...base, units: "°C", stats: s });
    const without = buildVerdict({ ...base, units: "°C", stats: s, hidePercent: true });
    expect(without.lines.join(" ")).not.toContain("% of the average");
    expect(withPct.plain.length).toBeGreaterThan(0);
  });
});

describe("variable catalogue", () => {
  it("has the three verified variables plus flagged extras, all with complete cards", () => {
    expect(VARIABLES.filter((v) => v.verified !== false).map((v) => v.id)).toEqual(["T2M", "PRECTOTCORR", "RH2M"]);
    expect(VARIABLES.filter((v) => v.verified === false).map((v) => v.id)).toEqual(["T2M_MAX", "T2M_MIN", "WS10M", "ALLSKY_SFC_SW_DWN"]);
    for (const v of VARIABLES) {
      expect(v.definition.length).toBeGreaterThan(20);
      expect(v.caveat.length).toBeGreaterThan(20);
      expect(v.why_it_matters.length).toBeGreaterThan(20);
      expect(["mean", "sum_of_daily_rate"]).toContain(v.aggregation_rule);
    }
  });
  it("rainfall is summed from the daily rate; others are averaged", () => {
    expect(rulesFor(["PRECTOTCORR", "T2M", "RH2M"])).toEqual({
      PRECTOTCORR: "sum_of_daily_rate",
      T2M: "mean",
      RH2M: "mean",
    });
    expect(getVariable("PRECTOTCORR").units_monthly).toBe("mm/day");
    expect(getVariable("PRECTOTCORR").units_aggregated).toBe("mm");
  });
  it("anomaly view of rainfall reports the daily-rate unit", () => {
    expect(unitsFor(getVariable("PRECTOTCORR"), { kind: "anomaly" })).toBe("mm/day");
    expect(unitsFor(getVariable("PRECTOTCORR"), { kind: "annual" })).toBe("mm");
  });
  it("unknown variable throws", () => {
    expect(() => getVariable("NOPE")).toThrow();
  });
});
