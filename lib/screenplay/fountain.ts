/**
 * Fountain <-> screenplay AST.
 *
 * Fountain (https://fountain.io) is a plain-text screenplay markup. We use it
 * as the portable/interchange format and as the canonical text that gets hashed
 * for the provenance trail, because plain text diffs cleanly and is unambiguous
 * to hash.
 *
 * `parse` turns Fountain text into a {@link Screenplay}. `serialize` turns a
 * Screenplay back into canonical Fountain. The two are designed to round-trip:
 * `parse(serialize(doc))` reproduces `doc` for the element types we support.
 */

import type {
  ElementType,
  Screenplay,
  ScreenplayElement,
  TitlePage,
} from "./types";

// --- Shared element detectors (used by both parser and serializer) -----------

const SCENE_HEADING_RE = /^(INT|EXT|EST|INT\.?\/EXT|I\/E|INT\/EXT)[.\s]/i;

/** True if a line reads as a scene heading without a forcing marker. */
export function looksLikeSceneHeading(text: string): boolean {
  return SCENE_HEADING_RE.test(text.trim());
}

/** True if a line reads as a transition (uppercase, ends in "TO:"). */
export function looksLikeTransition(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return false;
  if (t !== t.toUpperCase()) return false;
  return /TO:$/.test(t);
}

/**
 * True if a line reads as a character cue without a forcing marker:
 * uppercase, at least one letter, not ending in a colon. A trailing
 * parenthetical extension like "(V.O.)" or "(CONT'D)" is allowed.
 */
export function looksLikeCharacter(text: string): boolean {
  const t = text.trim().replace(/\s*\^$/, ""); // drop dual-dialogue caret
  if (t.length === 0) return false;
  if (t.endsWith(":")) return false;
  if (!/[A-Z]/.test(t)) return false;
  // Compare ignoring characters that are legitimately non-alphabetic.
  return t === t.toUpperCase();
}

const FORCING_CHARS = new Set([".", "!", "@", ">", "=", "#", "~"]);

// --- Title page --------------------------------------------------------------

const TITLE_KEY_MAP: Record<string, keyof TitlePage> = {
  title: "title",
  credit: "credit",
  author: "author",
  authors: "author",
  source: "source",
  "draft date": "draftDate",
  contact: "contact",
  copyright: "copyright",
  notes: "notes",
};

// Order in which known keys are emitted on serialize.
const TITLE_KEY_ORDER: [keyof TitlePage, string][] = [
  ["title", "Title"],
  ["credit", "Credit"],
  ["author", "Author"],
  ["source", "Source"],
  ["draftDate", "Draft date"],
  ["contact", "Contact"],
  ["copyright", "Copyright"],
  ["notes", "Notes"],
];

function parseTitlePage(lines: string[]): { titlePage: TitlePage; rest: string[] } {
  const titlePage: TitlePage = {};
  const extra: Record<string, string> = {};

  // A title page exists only if the very first non-empty line is "Key:" where
  // Key is a recognized title-page key. Requiring a known key avoids treating a
  // screenplay that opens with e.g. "CUT TO:" as a title page.
  const firstNonEmpty = lines.findIndex((l) => l.trim() !== "");
  if (firstNonEmpty === -1) return { titlePage, rest: lines };
  const firstMatch = lines[firstNonEmpty].match(/^([^\s:][^:]*):/);
  if (!firstMatch || !(firstMatch[1].trim().toLowerCase() in TITLE_KEY_MAP)) {
    return { titlePage, rest: lines };
  }

  let i = firstNonEmpty;
  let currentKey: string | null = null;
  let currentVal: string[] = [];

  const commit = () => {
    if (currentKey === null) return;
    const value = currentVal.join("\n").trim();
    const known = TITLE_KEY_MAP[currentKey.toLowerCase()];
    if (known) titlePage[known] = value as never;
    else extra[currentKey] = value;
    currentKey = null;
    currentVal = [];
  };

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      // Blank line terminates the title page.
      i++;
      break;
    }
    const m = line.match(/^([^\s:][^:]*):\s*(.*)$/);
    if (m && !/^\s/.test(line)) {
      commit();
      currentKey = m[1].trim();
      currentVal = m[2] !== "" ? [m[2].trim()] : [];
    } else {
      // Indented continuation line.
      currentVal.push(line.trim());
    }
  }
  commit();

  if (Object.keys(extra).length > 0) titlePage.extra = extra;
  return { titlePage, rest: lines.slice(i) };
}

// --- Parser ------------------------------------------------------------------

/** Parse Fountain text into a screenplay AST. */
export function parse(input: string): Screenplay {
  const allLines = input.replace(/\r\n?/g, "\n").split("\n");
  const { titlePage, rest } = parseTitlePage(allLines);

  const elements: ScreenplayElement[] = [];
  const lines = rest;
  let i = 0;

  const isBlank = (idx: number) => idx >= lines.length || lines[idx].trim() === "";

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // Forced page break: a line of 3+ equals signs.
    if (/^={3,}$/.test(trimmed)) {
      elements.push({ type: "page_break", text: "" });
      i++;
      continue;
    }

    // Section (# ...) — outline only.
    if (trimmed.startsWith("#")) {
      const depth = trimmed.match(/^#+/)![0].length;
      elements.push({ type: "section", text: trimmed.slice(depth).trim(), depth });
      i++;
      continue;
    }

    // Synopsis (= ...) — but not a page break (handled above).
    if (trimmed.startsWith("=")) {
      elements.push({ type: "synopsis", text: trimmed.slice(1).trim() });
      i++;
      continue;
    }

    // Centered: > text <
    if (trimmed.startsWith(">") && trimmed.endsWith("<")) {
      elements.push({ type: "centered", text: trimmed.slice(1, -1).trim() });
      i++;
      continue;
    }

    // Forced transition: > text
    if (trimmed.startsWith(">")) {
      elements.push({ type: "transition", text: trimmed.slice(1).trim() });
      i++;
      continue;
    }

    // Forced scene heading: .text  (but not "..." which escapes to action)
    if (trimmed.startsWith(".") && !trimmed.startsWith("..")) {
      const { text, sceneNumber } = extractSceneNumber(trimmed.slice(1).trim());
      elements.push({ type: "scene_heading", text, ...(sceneNumber ? { sceneNumber } : {}) });
      i++;
      continue;
    }

    // Forced action: !text
    if (trimmed.startsWith("!")) {
      const { text, next } = collectParagraph(lines, i, () => true);
      elements.push({ type: "action", text: stripFirstChar(text) });
      i = next;
      continue;
    }

    // Forced character: @NAME
    if (trimmed.startsWith("@")) {
      i = parseDialogueBlock(lines, i, elements, trimmed.slice(1));
      continue;
    }

    // Auto scene heading.
    if (looksLikeSceneHeading(trimmed)) {
      const { text, sceneNumber } = extractSceneNumber(trimmed);
      elements.push({ type: "scene_heading", text, ...(sceneNumber ? { sceneNumber } : {}) });
      i++;
      continue;
    }

    // Auto transition (uppercase, ends "TO:").
    if (looksLikeTransition(trimmed)) {
      elements.push({ type: "transition", text: trimmed });
      i++;
      continue;
    }

    // Auto character cue: uppercase line followed by a non-blank line.
    if (looksLikeCharacter(trimmed) && !isBlank(i + 1)) {
      i = parseDialogueBlock(lines, i, elements, trimmed);
      continue;
    }

    // Default: action paragraph (consecutive non-blank lines).
    {
      const { text, next } = collectParagraph(lines, i, () => false);
      elements.push({ type: "action", text });
      i = next;
    }
  }

  return { titlePage, elements };
}

function stripFirstChar(text: string): string {
  return text.startsWith("!") ? text.slice(1) : text;
}

/** Collect consecutive non-blank lines into a single joined paragraph. */
function collectParagraph(
  lines: string[],
  start: number,
  _force: () => boolean,
): { text: string; next: number } {
  const buf: string[] = [];
  let i = start;
  while (i < lines.length && lines[i].trim() !== "") {
    buf.push(lines[i].trim());
    i++;
  }
  return { text: buf.join("\n"), next: i };
}

/**
 * Parse a character cue and the dialogue block that follows it (parentheticals
 * and dialogue lines) until a blank line. Pushes elements and returns the next
 * line index.
 */
function parseDialogueBlock(
  lines: string[],
  start: number,
  elements: ScreenplayElement[],
  cueText: string,
): number {
  let name = cueText.trim();
  let dual: "left" | "right" | undefined;
  if (name.endsWith("^")) {
    dual = "right";
    name = name.replace(/\s*\^$/, "").trim();
  }
  elements.push({ type: "character", text: name, ...(dual ? { dual } : {}) });

  let i = start + 1;
  while (i < lines.length && lines[i].trim() !== "") {
    const t = lines[i].trim();
    if (t.startsWith("(") && t.endsWith(")")) {
      elements.push({ type: "parenthetical", text: t });
    } else {
      // Group consecutive plain lines into one dialogue element.
      const buf: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !(lines[i].trim().startsWith("(") && lines[i].trim().endsWith(")"))
      ) {
        buf.push(lines[i].trim());
        i++;
      }
      elements.push({ type: "dialogue", text: buf.join("\n") });
      continue;
    }
    i++;
  }
  return i;
}

function extractSceneNumber(text: string): { text: string; sceneNumber?: string } {
  const m = text.match(/^(.*?)\s*#([^#]+)#\s*$/);
  if (m) return { text: m[1].trim(), sceneNumber: m[2].trim() };
  return { text: text.trim() };
}

// --- Serializer --------------------------------------------------------------

/** Serialize a screenplay AST into canonical Fountain text. */
export function serialize(doc: Screenplay): string {
  const out: string[] = [];

  // Title page.
  const tp = doc.titlePage;
  const titleLines: string[] = [];
  for (const [key, label] of TITLE_KEY_ORDER) {
    const value = tp[key];
    if (typeof value === "string" && value.trim() !== "") {
      titleLines.push(formatTitleKey(label, value));
    }
  }
  if (tp.extra) {
    for (const [k, v] of Object.entries(tp.extra)) {
      if (v.trim() !== "") titleLines.push(formatTitleKey(k, v));
    }
  }
  if (titleLines.length > 0) {
    out.push(titleLines.join("\n"));
    out.push(""); // blank line terminating the title page
  }

  let prevType: ElementType | null = null;
  for (const el of doc.elements) {
    const needsBlankBefore = !(
      (el.type === "parenthetical" || el.type === "dialogue") &&
      (prevType === "character" ||
        prevType === "parenthetical" ||
        prevType === "dialogue")
    );
    if (out.length > 0 && needsBlankBefore) out.push("");

    out.push(serializeElement(el));
    prevType = el.type;
  }

  return out.join("\n");
}

function formatTitleKey(label: string, value: string): string {
  const parts = value.split("\n");
  if (parts.length === 1) return `${label}: ${value}`;
  // Multi-line values continue on indented lines.
  return `${label}:\n` + parts.map((p) => `   ${p}`).join("\n");
}

function serializeElement(el: ScreenplayElement): string {
  switch (el.type) {
    case "scene_heading": {
      const num = el.sceneNumber ? ` #${el.sceneNumber}#` : "";
      const body = looksLikeSceneHeading(el.text) ? el.text : `.${el.text}`;
      return `${body}${num}`;
    }
    case "transition":
      return looksLikeTransition(el.text) ? el.text : `> ${el.text}`;
    case "centered":
      return `> ${el.text} <`;
    case "character": {
      const caret = el.dual === "right" ? " ^" : "";
      const body = looksLikeCharacter(el.text) ? el.text : `@${el.text}`;
      return `${body}${caret}`;
    }
    case "parenthetical":
      return el.text;
    case "dialogue":
      return el.text;
    case "section":
      return `${"#".repeat(el.depth ?? 1)} ${el.text}`;
    case "synopsis":
      return `= ${el.text}`;
    case "page_break":
      return "===";
    case "action":
    case "shot":
    default:
      return needsActionForcing(el.text) ? `!${el.text}` : el.text;
  }
}

/**
 * Action must be forced with "!" when its first line would otherwise be
 * reparsed as another element (scene heading, transition, character, centered)
 * or begins with a forcing character.
 */
function needsActionForcing(text: string): boolean {
  const first = text.split("\n")[0].trim();
  if (first === "") return false;
  if (FORCING_CHARS.has(first[0])) return true;
  if (looksLikeSceneHeading(first)) return true;
  if (looksLikeTransition(first)) return true;
  if (looksLikeCharacter(first)) return true;
  return false;
}
