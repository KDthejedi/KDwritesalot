import { describe, expect, it } from "vitest";
import { toPdf } from "./pdf";
import type { Screenplay } from "../screenplay/types";

const doc: Screenplay = {
  titlePage: { title: "The Long Drive", credit: "Written by", author: "Jane Writer" },
  elements: [
    { type: "scene_heading", text: "INT. CAR - NIGHT" },
    { type: "action", text: "Rain hammers the windshield." },
    { type: "character", text: "SAM" },
    { type: "dialogue", text: "We should have turned back." },
  ],
};

describe("PDF export (smoke)", () => {
  it("produces a non-empty PDF buffer", async () => {
    const buf = await toPdf(doc);
    expect(buf.length).toBeGreaterThan(0);
    // A valid PDF starts with "%PDF-".
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("handles an empty screenplay without throwing", async () => {
    const buf = await toPdf({ titlePage: {}, elements: [] });
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
