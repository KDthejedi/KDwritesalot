/**
 * Screenplay page layout (pure geometry, no rendering dependency).
 *
 * Encodes standard US screenplay format: US Letter paper, Courier 12pt
 * (10 characters per inch, 6 lines per inch), with the conventional left
 * indents and text widths for each element type. This module turns a
 * {@link Screenplay} into positioned text lines across paginated pages; the
 * pdfkit renderer in `pdf.ts` just draws what this computes. Keeping it pure
 * makes the layout unit-testable.
 */

import type { Screenplay, ScreenplayElement } from "../screenplay/types";

export const PAGE = {
  widthIn: 8.5,
  heightIn: 11,
  topMarginIn: 1.0,
  bottomMarginIn: 1.0,
  charsPerInch: 10, // Courier 12pt
  linesPerInch: 6,
};

/** Usable vertical lines per page (9" of text at 6 lines/inch = 54). */
export const LINES_PER_PAGE = Math.floor(
  (PAGE.heightIn - PAGE.topMarginIn - PAGE.bottomMarginIn) * PAGE.linesPerInch,
);

/** Per-element horizontal geometry, in inches from the left paper edge. */
interface Geometry {
  leftIn: number;
  widthIn: number;
  /** Blank lines placed before this element (ignored at the top of a page). */
  spaceBefore: number;
  centered?: boolean;
}

const GEOMETRY: Record<ScreenplayElement["type"], Geometry> = {
  scene_heading: { leftIn: 1.5, widthIn: 6.0, spaceBefore: 1 },
  action: { leftIn: 1.5, widthIn: 6.0, spaceBefore: 1 },
  character: { leftIn: 3.7, widthIn: 3.3, spaceBefore: 1 },
  parenthetical: { leftIn: 3.1, widthIn: 2.0, spaceBefore: 0 },
  dialogue: { leftIn: 2.5, widthIn: 3.5, spaceBefore: 0 },
  transition: { leftIn: 6.0, widthIn: 1.5, spaceBefore: 1 },
  shot: { leftIn: 1.5, widthIn: 6.0, spaceBefore: 1 },
  centered: { leftIn: 1.5, widthIn: 6.0, spaceBefore: 1, centered: true },
  section: { leftIn: 1.5, widthIn: 6.0, spaceBefore: 1 }, // not printed
  synopsis: { leftIn: 1.5, widthIn: 6.0, spaceBefore: 1 }, // not printed
  page_break: { leftIn: 1.5, widthIn: 6.0, spaceBefore: 0 },
};

/** A single positioned line of text on a page. */
export interface LaidOutLine {
  text: string;
  xIn: number;
  /** Vertical line slot on the page, 0-based. */
  lineIndex: number;
  type: ScreenplayElement["type"];
}

export type Page = LaidOutLine[];

/**
 * Word-wrap `text` to a maximum character width. Explicit newlines are honored
 * as hard breaks. Never returns an empty array (an empty string yields [""]).
 */
export function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = [];
  const hardLines = text.split("\n");
  for (const hard of hardLines) {
    if (hard.length <= maxChars) {
      out.push(hard);
      continue;
    }
    const words = hard.split(/\s+/);
    let line = "";
    for (const word of words) {
      if (line === "") {
        line = word;
      } else if ((line + " " + word).length <= maxChars) {
        line += " " + word;
      } else {
        out.push(line);
        line = word;
      }
      // A single word longer than the width is hard-split.
      while (line.length > maxChars) {
        out.push(line.slice(0, maxChars));
        line = line.slice(maxChars);
      }
    }
    out.push(line);
  }
  return out.length > 0 ? out : [""];
}

function centeredX(text: string): number {
  const usableLeft = 1.5;
  const usableRight = PAGE.widthIn - 1.0;
  const center = (usableLeft + usableRight) / 2;
  const textWidthIn = text.length / PAGE.charsPerInch;
  return center - textWidthIn / 2;
}

/**
 * Lay a screenplay out into paginated, positioned lines. Non-printing outline
 * elements (section, synopsis) are skipped.
 */
export function layoutScreenplay(doc: Screenplay): Page[] {
  const pages: Page[] = [];
  let current: Page = [];
  let cursor = 0; // next free line slot on the current page

  const newPage = () => {
    pages.push(current);
    current = [];
    cursor = 0;
  };

  for (const el of doc.elements) {
    if (el.type === "section" || el.type === "synopsis") continue;

    if (el.type === "page_break") {
      if (current.length > 0) newPage();
      continue;
    }

    const geo = GEOMETRY[el.type];
    const wrapped = wrapText(el.text, Math.round(geo.widthIn * PAGE.charsPerInch));
    const space = cursor === 0 ? 0 : geo.spaceBefore;

    // If this element (plus its leading space) doesn't fit, start a new page.
    // Orphan control: a character cue keeps at least one following line, so it
    // needs room for 2 lines minimum at the bottom of a page.
    const minNeeded = el.type === "character" ? space + Math.min(wrapped.length + 1, 2) : space + 1;
    if (cursor + minNeeded > LINES_PER_PAGE && current.length > 0) {
      newPage();
    }

    cursor += cursor === 0 ? 0 : space;

    for (const lineText of wrapped) {
      if (cursor >= LINES_PER_PAGE) newPage();
      const xIn = geo.centered ? centeredX(lineText) : geo.leftIn;
      current.push({ text: lineText, xIn, lineIndex: cursor, type: el.type });
      cursor += 1;
    }
  }

  if (current.length > 0) pages.push(current);
  return pages;
}
