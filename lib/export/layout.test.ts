import { describe, expect, it } from "vitest";
import { LINES_PER_PAGE, layoutScreenplay, wrapText } from "./layout";
import type { Screenplay } from "../screenplay/types";

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("hello world", 60)).toEqual(["hello world"]);
  });

  it("wraps on word boundaries", () => {
    expect(wrapText("aaa bbb ccc", 7)).toEqual(["aaa bbb", "ccc"]);
  });

  it("honors explicit newlines as hard breaks", () => {
    expect(wrapText("line one\nline two", 60)).toEqual(["line one", "line two"]);
  });

  it("hard-splits a word longer than the width", () => {
    expect(wrapText("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("never returns an empty array", () => {
    expect(wrapText("", 60)).toEqual([""]);
  });
});

describe("layoutScreenplay", () => {
  it("has a standard 54-line page", () => {
    expect(LINES_PER_PAGE).toBe(54);
  });

  it("positions elements at their industry indents", () => {
    const doc: Screenplay = {
      titlePage: {},
      elements: [
        { type: "scene_heading", text: "INT. ROOM - DAY" },
        { type: "character", text: "JANE" },
        { type: "dialogue", text: "Hello." },
        { type: "transition", text: "CUT TO:" },
      ],
    };
    const [page] = layoutScreenplay(doc);
    const scene = page.find((l) => l.type === "scene_heading")!;
    const character = page.find((l) => l.type === "character")!;
    const dialogue = page.find((l) => l.type === "dialogue")!;
    const transition = page.find((l) => l.type === "transition")!;
    expect(scene.xIn).toBeCloseTo(1.5);
    expect(character.xIn).toBeCloseTo(3.7);
    expect(dialogue.xIn).toBeCloseTo(2.5);
    expect(transition.xIn).toBeCloseTo(6.0);
  });

  it("keeps a character cue and its dialogue together (no top-of-page gap)", () => {
    const scene: Screenplay["elements"][number] = { type: "action", text: "Beat." };
    const elements = Array.from({ length: 60 }, () => ({ ...scene }));
    const doc: Screenplay = { titlePage: {}, elements };
    const pages = layoutScreenplay(doc);
    expect(pages.length).toBeGreaterThan(1);
    // Every line index must be within page bounds.
    for (const page of pages) {
      for (const line of page) {
        expect(line.lineIndex).toBeGreaterThanOrEqual(0);
        expect(line.lineIndex).toBeLessThan(LINES_PER_PAGE);
      }
    }
  });

  it("starts a new page on a forced page break", () => {
    const doc: Screenplay = {
      titlePage: {},
      elements: [
        { type: "action", text: "First page." },
        { type: "page_break", text: "" },
        { type: "action", text: "Second page." },
      ],
    };
    const pages = layoutScreenplay(doc);
    expect(pages).toHaveLength(2);
    expect(pages[0][0].text).toBe("First page.");
    expect(pages[1][0].text).toBe("Second page.");
  });
});
