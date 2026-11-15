import { describe, expect, it } from "vitest";
import { parseCandidateProposal } from "../ragService";

describe("parseCandidateProposal", () => {
  it("accepts fenced JSON and drops unknown catalogue IDs", () => {
    expect(parseCandidateProposal('```json\n{"variables":["T2M","not-a-variable","T2M"],"reason":"temperature"}\n```')).toEqual({
      variables: ["T2M"],
      reason: "temperature",
    });
  });

  it("handles malformed JSON without throwing", () => {
    expect(parseCandidateProposal("not json")).toEqual({
      variables: [],
      reason: "The model returned malformed JSON. Choose variables from the catalogue instead.",
    });
  });
});
