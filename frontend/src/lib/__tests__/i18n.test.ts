import { describe, expect, it } from "vitest";
import { getCopy, LANGUAGES } from "../../i18n";

describe("interface languages", () => {
  it("offers English, Hindi, Marathi and Bengali", () => {
    expect(LANGUAGES.map((language) => language.id)).toEqual(["en", "hi", "mr", "bn"]);
  });

  it("keeps the assistant no-result message clear in every language", () => {
    for (const language of LANGUAGES) {
      expect(getCopy(language.id).assistant.noResult.length).toBeGreaterThan(10);
    }
  });
});
