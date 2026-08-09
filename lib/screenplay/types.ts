/**
 * Core screenplay document model.
 *
 * The app stores and manipulates screenplays as this structured AST. Every
 * other representation — the on-screen editor, Fountain text, Final Draft
 * `.fdx`, and the exported PDF — is derived from it. Keeping one canonical
 * model is what makes lossless round-tripping and stable content hashing
 * (for the version history / provenance trail) possible.
 */

/** The industry-standard screenplay element types. */
export type ElementType =
  | "scene_heading" // INT. HOUSE - DAY
  | "action" // Descriptive prose.
  | "character" // JANE
  | "parenthetical" // (whispering)
  | "dialogue" // The spoken line.
  | "transition" // CUT TO:
  | "shot" // ANGLE ON, CLOSE ON
  | "centered" // > centered text <
  | "section" // Fountain outline section (# Act One) — not printed
  | "synopsis" // Fountain synopsis (= a beat) — not printed
  | "page_break"; // Forced page break (===)

/** A single block-level element in the screenplay body. */
export interface ScreenplayElement {
  type: ElementType;
  /** The element's plain text (already unwrapped; wrapping happens at render time). */
  text: string;
  /**
   * Optional scene number for scene headings (e.g. "1", "12A"). Preserved on
   * import/export but not required.
   */
  sceneNumber?: string;
  /**
   * Dual-dialogue side, when two characters speak simultaneously.
   * "left" / "right" mark the two columns; undefined means normal dialogue.
   */
  dual?: "left" | "right";
  /** Outline depth for `section` elements (number of leading #). */
  depth?: number;
}

/**
 * Title-page metadata. Known keys drive the printed title page and export
 * metadata; unknown keys are preserved for round-tripping.
 */
export interface TitlePage {
  title?: string;
  credit?: string; // e.g. "Written by"
  author?: string;
  source?: string; // e.g. "based on the novel by ..."
  draftDate?: string;
  contact?: string;
  copyright?: string; // e.g. "(c) 2026 Jane Writer"
  notes?: string;
  /** Any additional custom key/value pairs from a Fountain title page. */
  extra?: Record<string, string>;
}

/** A complete screenplay: optional title page plus an ordered list of elements. */
export interface Screenplay {
  titlePage: TitlePage;
  elements: ScreenplayElement[];
}

/** An empty screenplay, used as a starting point for new documents. */
export function emptyScreenplay(): Screenplay {
  return { titlePage: {}, elements: [] };
}
