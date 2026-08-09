/**
 * Editor formatting behaviors (pure logic).
 *
 * These functions encode the Final Draft-style editing conventions screenwriters
 * expect — what element you get when you press Enter, how Tab cycles element
 * types, and how each element's text is auto-formatted (e.g. scene headings and
 * character cues uppercase). They are pure so the editor UI stays thin and the
 * rules are unit-testable.
 */

import type { ElementType } from "./types";

/** Element types the editor lets you cycle through with Tab, in order. */
export const CYCLE_ORDER: ElementType[] = [
  "scene_heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
];

/** Human-readable labels for each element type (for the editor UI). */
export const ELEMENT_LABELS: Record<ElementType, string> = {
  scene_heading: "Scene Heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
  shot: "Shot",
  centered: "Centered",
  section: "Section",
  synopsis: "Synopsis",
  page_break: "Page Break",
};

/**
 * The element type to create when pressing Enter at the end of an element of the
 * given type — mirrors Final Draft's flow (Character -> Dialogue, etc.).
 */
export function nextTypeOnEnter(current: ElementType): ElementType {
  switch (current) {
    case "scene_heading":
      return "action";
    case "character":
      return "dialogue";
    case "parenthetical":
      return "dialogue";
    case "dialogue":
      return "character";
    case "transition":
      return "scene_heading";
    default:
      return "action";
  }
}

/** The next type when cycling with Tab (wraps around CYCLE_ORDER). */
export function cycleType(current: ElementType, direction: 1 | -1 = 1): ElementType {
  const idx = CYCLE_ORDER.indexOf(current);
  if (idx === -1) return CYCLE_ORDER[0];
  const next = (idx + direction + CYCLE_ORDER.length) % CYCLE_ORDER.length;
  return CYCLE_ORDER[next];
}

/**
 * Auto-format an element's text for its type: uppercase scene headings,
 * character cues, transitions, and shots; ensure parentheticals are wrapped in
 * parentheses. Other types are returned unchanged.
 */
export function formatText(type: ElementType, text: string): string {
  switch (type) {
    case "scene_heading":
    case "character":
    case "transition":
    case "shot":
      return text.toUpperCase();
    case "parenthetical": {
      const inner = text.replace(/^\(+/, "").replace(/\)+$/, "").trim();
      return inner === "" ? "" : `(${inner})`;
    }
    default:
      return text;
  }
}

/**
 * Suggested autocomplete completions for the current element and partial text.
 * Scene headings suggest INT./EXT. prefixes and known locations; character
 * elements suggest known character names. Case-insensitive prefix match.
 */
export function suggestCompletions(
  type: ElementType,
  partial: string,
  context: { locations?: string[]; characters?: string[] } = {},
): string[] {
  const p = partial.trim().toUpperCase();
  if (type === "scene_heading") {
    const prefixes = ["INT. ", "EXT. ", "INT./EXT. ", "EST. "];
    // If a prefix is already present, suggest known locations after it.
    const matchedPrefix = prefixes.find((pre) => p.startsWith(pre.trim()));
    if (matchedPrefix && context.locations) {
      const afterPrefix = p.slice(matchedPrefix.trim().length).trimStart();
      return context.locations
        .filter((loc) => loc.toUpperCase().startsWith(afterPrefix))
        .map((loc) => `${matchedPrefix}${loc.toUpperCase()}`);
    }
    return prefixes.filter((pre) => pre.trim().startsWith(p) || p === "");
  }
  if (type === "character" && context.characters) {
    return context.characters
      .map((c) => c.toUpperCase())
      .filter((c) => c.startsWith(p) && c !== p);
  }
  return [];
}

/** Collect distinct character names already used in a list of elements. */
export function collectCharacterNames(
  elements: { type: ElementType; text: string }[],
): string[] {
  const seen = new Set<string>();
  for (const el of elements) {
    if (el.type === "character") {
      const name = el.text.replace(/\s*\(.*\)\s*$/, "").trim().toUpperCase();
      if (name) seen.add(name);
    }
  }
  return [...seen];
}
