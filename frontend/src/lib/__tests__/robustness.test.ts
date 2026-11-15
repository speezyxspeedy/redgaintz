import { describe, expect, it } from "vitest";
import { enumerateRobustnessWindows } from "../robustness";

describe("enumerateRobustnessWindows", () => {
  it("counts every overlapping window of at least ten years", () => {
    const years = Array.from({ length: 12 }, (_, index) => 2000 + index);
    const windows = enumerateRobustnessWindows(years, years.map((year) => year - 1999));
    expect(windows).toHaveLength(6);
    expect(windows.map((window) => `${window.startYear}-${window.endYear}`)).toEqual([
      "2000-2009",
      "2000-2010",
      "2000-2011",
      "2001-2010",
      "2001-2011",
      "2002-2011",
    ]);
  });

  it("keeps a window but marks it unavailable when missing values leave too little data", () => {
    const years = Array.from({ length: 10 }, (_, index) => 2000 + index);
    const windows = enumerateRobustnessWindows(years, Array(10).fill(null));
    expect(windows).toHaveLength(1);
    expect(windows[0].stats).toBeNull();
  });
});
