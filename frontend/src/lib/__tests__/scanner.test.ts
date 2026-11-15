import { describe, expect, it } from "vitest";
import { aggregate } from "../aggregate";
import { benjaminiHochberg } from "../scanner";

describe("benjaminiHochberg", () => {
  it("adjusts the known equal-rank case", () => {
    expect(benjaminiHochberg([0.01, 0.02, 0.03, 0.04, 0.05])).toEqual([0.05, 0.05, 0.05, 0.05, 0.05]);
  });

  it("returns adjusted values in original order", () => {
    expect(benjaminiHochberg([0.001, 0.2, 0.04])).toEqual([0.003, 0.2, 0.06]);
  });
});

describe("scanner annual aggregation", () => {
  it("uses calendar month lengths and preserves a missing year", () => {
    const series = {
      variable_id: "PRECTOTCORR",
      name: "Rainfall",
      units: "mm/day",
      rule: "sum_of_daily_rate" as const,
      series: [
        ...Array.from({ length: 12 }, (_, index) => ({ year: 2020, month: index + 1, value: 1 })),
        ...Array.from({ length: 12 }, (_, index) => ({ year: 2021, month: index + 1, value: index === 1 ? null : 1 })),
      ],
    };
    const annual = aggregate(series, { kind: "annual" }, { startYear: 2020, endYear: 2021 });
    expect(annual.values).toEqual([366, null]);
    expect(annual.yearsUsed).toEqual([2020]);
  });
});
