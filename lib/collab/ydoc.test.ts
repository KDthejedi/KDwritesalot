import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  appendElement,
  elementsArray,
  initFromScreenplay,
  insertElement,
  readScreenplay,
  setElementText,
} from "./ydoc";
import type { Screenplay } from "@/lib/screenplay/types";

const sample: Screenplay = {
  titlePage: { title: "The Long Drive", author: "Jane Writer" },
  elements: [
    { type: "scene_heading", text: "INT. CAR - NIGHT" },
    { type: "action", text: "Rain hammers the windshield." },
    { type: "character", text: "SAM" },
    { type: "dialogue", text: "We should have turned back." },
  ],
};

function stripIds(doc: Screenplay) {
  return {
    titlePage: doc.titlePage,
    elements: doc.elements.map((e) => ({ type: e.type, text: e.text })),
  };
}

describe("ydoc", () => {
  it("initializes from and reads back a screenplay", () => {
    const doc = new Y.Doc();
    initFromScreenplay(doc, sample);
    const read = readScreenplay(doc);
    expect(stripIds(read)).toEqual(stripIds(sample));
  });

  it("does not re-initialize a non-empty doc", () => {
    const doc = new Y.Doc();
    initFromScreenplay(doc, sample);
    initFromScreenplay(doc, { titlePage: {}, elements: [{ type: "action", text: "other" }] });
    expect(readScreenplay(doc).elements).toHaveLength(sample.elements.length);
  });

  it("applies minimal-diff text edits", () => {
    const doc = new Y.Doc();
    initFromScreenplay(doc, sample);
    setElementText(doc, 1, "Rain hammers the CRACKED windshield.");
    expect(readScreenplay(doc).elements[1].text).toBe("Rain hammers the CRACKED windshield.");
  });

  it("merges concurrent edits to different offsets of one line", () => {
    // Two docs start from the same state, edit different parts, then sync.
    const a = new Y.Doc();
    initFromScreenplay(a, { titlePage: {}, elements: [{ type: "action", text: "the quick brown fox" }] });
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    setElementText(a, 0, "THE quick brown fox"); // edit start
    setElementText(b, 0, "the quick brown foxes"); // edit end

    // Exchange updates.
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));

    const textA = readScreenplay(a).elements[0].text;
    const textB = readScreenplay(b).elements[0].text;
    expect(textA).toBe(textB); // converged
    expect(textA).toContain("THE");
    expect(textA).toContain("foxes");
  });

  it("appends and inserts elements", () => {
    const doc = new Y.Doc();
    initFromScreenplay(doc, sample);
    const arr = elementsArray(doc);
    appendElement(arr, { type: "transition", text: "CUT TO:" });
    insertElement(arr, 0, { type: "section", text: "Act One", depth: 1 });
    const els = readScreenplay(doc).elements;
    expect(els[0]).toMatchObject({ type: "section", text: "Act One" });
    expect(els[els.length - 1]).toMatchObject({ type: "transition", text: "CUT TO:" });
  });
});
