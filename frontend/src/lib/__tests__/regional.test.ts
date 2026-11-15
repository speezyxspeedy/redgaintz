import { describe, expect, it } from "vitest";
import { cellExtent, parseRegionalDaily } from "../regional";

const response = {
  header: { fill_value: -999 },
  parameters: { PRECTOTCORR: { units: "mm/day" } },
  features: [
    { geometry: { coordinates: [79, 21] }, properties: { parameter: { PRECTOTCORR: { "20200101": 1, "20200102": 2, "20210101": 3 } } } },
    { geometry: { coordinates: [79.5, 21] }, properties: { parameter: { PRECTOTCORR: { "20200101": 2, "20200102": 3, "20210101": 4 } } } },
    { geometry: { coordinates: [79, 21.5] }, properties: { parameter: { PRECTOTCORR: { "20200101": 4, "20200102": 5, "20210101": 6 } } } },
  ],
};

describe("regional cell trends", () => {
  it("aggregates daily rates and preserves the returned grid", () => {
    const result = parseRegionalDaily(response, {
      variableId: "PRECTOTCORR",
      startYear: 2020,
      endYear: 2021,
      bounds: { west: 78, south: 20, east: 81, north: 22 },
    }, "https://example.test", "2026-01-01T00:00:00.000Z");
    expect(result.cells[0].annualValues).toEqual([3, 3]);
    expect(result.units).toBe("mm/year");
    expect(cellExtent(result.cells)).toEqual({ halfWidth: 0.25, halfHeight: 0.25 });
  });
});
