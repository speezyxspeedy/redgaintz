import { describe, expect, it } from "vitest";
import { advancedStats, compareSamples, pettitt, phi, quantile } from "../advanced";

describe("advanced statistics (known answers)", () => {
  it("phi matches the normal CDF", () => { expect(phi(0)).toBeCloseTo(0.5, 6); expect(phi(1.96)).toBeCloseTo(0.975, 3); });
  it("quantile interpolates", () => { expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3); expect(quantile([0, 10], 0.25)).toBe(2.5); });
  it("Pettitt finds a clean step", () => {
    const y = [...Array(12).fill(1), ...Array(12).fill(5)].map((v, i) => v + (i % 3) * 0.01);
    const r = pettitt(y);
    expect(r.index).toBe(11); expect(r.p).toBeLessThan(0.001); expect(r.after - r.before).toBeGreaterThan(3.9);
  });
  it("Pettitt does not flag a flat noisy series", () => { expect(pettitt([3, 5, 2, 6, 3, 5, 2, 6, 3, 5, 2, 6]).significant).toBe(false); });
  it("Mann–Whitney and Welch agree on a clear shift", () => {
    const r = compareSamples([1, 2, 3, 2, 1, 2, 3, 2], [8, 9, 10, 9, 8, 9, 10, 9]);
    expect(r.mwP).toBeLessThan(0.01); expect(r.welchP).toBeLessThan(0.001); expect(r.diff).toBeCloseTo(7, 5);
  });
  it("needs at least 10 values", () => { expect(advancedStats([1, 2, 3], [1, 2, 3], "mm")).toBeNull(); });
  it("keeps probabilities in [0,1] and skips missing years", () => {
    const yrs = Array.from({ length: 30 }, (_, i) => 1990 + i), vals = yrs.map((_, i) => (i === 4 ? null : 100 + Math.sin(i) * 10 + i));
    const a = advancedStats(yrs, vals, "mm")!;
    expect(a.n).toBe(29);
    for (const p of [a.prob.lowNext, a.prob.highNext, a.prob.lowObserved]) { expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
    expect(a.forecast.at(-1)!.year).toBe(2024); expect(a.returns[0].period).toBeCloseTo(30, 5);
  });
});
