import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyseTrend } from "../stats";

interface Case {
  name: string;
  years: number[];
  values: Array<number | null>;
  alpha: number;
  expect_error?: string;
  expected?: Record<string, unknown>;
}

const fixtureUrl = new URL("../../../../tests/fixtures/stats_expected.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf-8")) as {
  tolerance: number;
  cases: Case[];
};

// null in the fixture means "NaN / undefined" in Python.
function expectClose(actual: unknown, expected: unknown, tol: number, path: string) {
  if (expected === null) {
    const ok = actual === null || (typeof actual === "number" && Number.isNaN(actual));
    expect(ok, `${path}: expected null/NaN, got ${String(actual)}`).toBe(true);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    (expected as unknown[]).forEach((e, i) => expectClose((actual as unknown[])[i], e, tol, `${path}[${i}]`));
  } else if (typeof expected === "number") {
    expect(typeof actual, path).toBe("number");
    const diff = Math.abs((actual as number) - expected);
    expect(diff <= tol * Math.max(1, Math.abs(expected)), `${path}: ${String(actual)} vs ${expected}`).toBe(true);
  } else {
    expect(actual, path).toEqual(expected);
  }
}

describe("analyseTrend matches pipeline/trend.py (scipy)", () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      if (c.expect_error) {
        expect(() => analyseTrend(c.years, c.values, c.alpha)).toThrow();
        return;
      }
      const got = analyseTrend(c.years, c.values, c.alpha) as unknown as Record<string, unknown>;
      for (const [key, exp] of Object.entries(c.expected!)) {
        if (key === "method" || key === "interpretation") continue;
        expectClose(got[key], exp, fixture.tolerance, `${c.name}.${key}`);
      }
    });
  }
});
