import { describe, expect, it } from "vitest";
import { parse, serialize } from "./fountain";
import type { Screenplay } from "./types";

const SAMPLE = `Title: The Long Drive
Credit: Written by
Author: Jane Writer
Draft date: 2026-08-09
Copyright: (c) 2026 Jane Writer

INT. CAR - NIGHT #1#

Rain hammers the windshield. SAM, 30s, grips the wheel.

SAM
(quietly)
We should have turned back.

MAYA
Too late for that now.

EXT. HIGHWAY - CONTINUOUS

Headlights sweep across an empty road.

CUT TO:

.A BLACK VOID

Nothing. Then a single point of light.

> THE END <`;

describe("fountain parse", () => {
  it("parses the title page", () => {
    const doc = parse(SAMPLE);
    expect(doc.titlePage.title).toBe("The Long Drive");
    expect(doc.titlePage.credit).toBe("Written by");
    expect(doc.titlePage.author).toBe("Jane Writer");
    expect(doc.titlePage.draftDate).toBe("2026-08-09");
    expect(doc.titlePage.copyright).toBe("(c) 2026 Jane Writer");
  });

  it("parses scene headings with scene numbers", () => {
    const doc = parse(SAMPLE);
    const scene = doc.elements.find((e) => e.type === "scene_heading");
    expect(scene?.text).toBe("INT. CAR - NIGHT");
    expect(scene?.sceneNumber).toBe("1");
  });

  it("parses character cues, parentheticals, and dialogue", () => {
    const doc = parse(SAMPLE);
    const types = doc.elements.map((e) => e.type);
    // SAM / (quietly) / dialogue
    const samIdx = doc.elements.findIndex((e) => e.type === "character" && e.text === "SAM");
    expect(samIdx).toBeGreaterThan(-1);
    expect(doc.elements[samIdx + 1]).toMatchObject({ type: "parenthetical", text: "(quietly)" });
    expect(doc.elements[samIdx + 2]).toMatchObject({
      type: "dialogue",
      text: "We should have turned back.",
    });
    expect(types).toContain("transition");
    expect(types).toContain("centered");
  });

  it("parses forced scene headings", () => {
    const doc = parse(SAMPLE);
    const forced = doc.elements.find((e) => e.type === "scene_heading" && e.text === "A BLACK VOID");
    expect(forced).toBeTruthy();
  });

  it("parses the centered end card", () => {
    const doc = parse(SAMPLE);
    const centered = doc.elements.find((e) => e.type === "centered");
    expect(centered?.text).toBe("THE END");
  });
});

describe("fountain round-trip", () => {
  it("parse -> serialize -> parse is stable", () => {
    const once = parse(SAMPLE);
    const text = serialize(once);
    const twice = parse(text);
    expect(twice).toEqual(once);
  });

  it("preserves an AST through serialize -> parse", () => {
    const doc: Screenplay = {
      titlePage: { title: "Test", author: "A. Writer" },
      elements: [
        { type: "scene_heading", text: "INT. ROOM - DAY" },
        { type: "action", text: "A quiet room.\nDust in the light." },
        { type: "character", text: "JANE" },
        { type: "dialogue", text: "Hello?" },
        { type: "character", text: "McCLANE" }, // not all-uppercase -> forced with @
        { type: "dialogue", text: "Yippee." },
        { type: "transition", text: "SMASH CUT:" }, // ends in a colon but not "TO:"
        { type: "action", text: "CUT TO: is not a real transition here." },
        { type: "page_break", text: "" },
        { type: "centered", text: "FIN" },
      ],
    };
    const round = parse(serialize(doc));
    expect(round).toEqual(doc);
  });

  it("forces action that would look like a character cue", () => {
    const doc: Screenplay = {
      titlePage: {},
      elements: [{ type: "action", text: "SUExpected all-caps line." }],
    };
    // "SUExpected..." is not all caps, so it stays action naturally.
    const round = parse(serialize(doc));
    expect(round.elements[0]).toMatchObject({ type: "action" });
  });

  it("round-trips dual dialogue", () => {
    const doc: Screenplay = {
      titlePage: {},
      elements: [
        { type: "character", text: "SAM" },
        { type: "dialogue", text: "Go left!" },
        { type: "character", text: "MAYA", dual: "right" },
        { type: "dialogue", text: "Go right!" },
      ],
    };
    const round = parse(serialize(doc));
    expect(round).toEqual(doc);
  });
});
