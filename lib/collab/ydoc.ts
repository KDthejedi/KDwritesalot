/**
 * Yjs document model for a screenplay, shared by the editor and (indirectly)
 * the Hocuspocus server.
 *
 * Layout:
 *   doc.getArray("elements")  → Y.Array of Y.Map, each { id, type, text: Y.Text,
 *                               sceneNumber?, dual?, depth? }
 *   doc.getMap("titlePage")   → Y.Map of string metadata fields
 *
 * Storing each element's text as a Y.Text gives character-level CRDT merging, so
 * two people editing the same line converge instead of clobbering each other.
 */

import * as Y from "yjs";
import type {
  ElementType,
  Screenplay,
  ScreenplayElement,
  TitlePage,
} from "@/lib/screenplay/types";

/** Origin tag for transactions initiated by the local user. */
export const LOCAL_ORIGIN = "local-user";

export function elementsArray(doc: Y.Doc): Y.Array<Y.Map<unknown>> {
  return doc.getArray<Y.Map<unknown>>("elements");
}

export function titlePageMap(doc: Y.Doc): Y.Map<string> {
  return doc.getMap<string>("titlePage");
}

let counter = 0;
function makeId(): string {
  counter += 1;
  return `y-${Date.now().toString(36)}-${counter}`;
}

/** Build a detached Y.Map for an element (text inserted after integration). */
function buildElementMap(el: ScreenplayElement & { id?: string }): {
  map: Y.Map<unknown>;
  text: string;
} {
  const map = new Y.Map<unknown>();
  map.set("id", el.id ?? makeId());
  map.set("type", el.type);
  map.set("text", new Y.Text());
  if (el.sceneNumber) map.set("sceneNumber", el.sceneNumber);
  if (el.dual) map.set("dual", el.dual);
  if (typeof el.depth === "number") map.set("depth", el.depth);
  return { map, text: el.text ?? "" };
}

/** Append an element to the array, integrating its Y.Text then inserting text. */
export function appendElement(
  arr: Y.Array<Y.Map<unknown>>,
  el: ScreenplayElement & { id?: string },
): Y.Map<unknown> {
  const { map, text } = buildElementMap(el);
  arr.push([map]);
  if (text) (map.get("text") as Y.Text).insert(0, text);
  return map;
}

/** Insert an element at a specific index. */
export function insertElement(
  arr: Y.Array<Y.Map<unknown>>,
  index: number,
  el: ScreenplayElement & { id?: string },
): Y.Map<unknown> {
  const { map, text } = buildElementMap(el);
  arr.insert(index, [map]);
  if (text) (map.get("text") as Y.Text).insert(0, text);
  return map;
}

/** Populate an empty doc from a Screenplay (no-op if the doc already has data). */
export function initFromScreenplay(doc: Y.Doc, screenplay: Screenplay): void {
  const arr = elementsArray(doc);
  const tp = titlePageMap(doc);
  if (arr.length > 0) return;
  doc.transact(() => {
    for (const [k, v] of Object.entries(screenplay.titlePage)) {
      if (typeof v === "string") tp.set(k, v);
    }
    const els = screenplay.elements.length
      ? screenplay.elements
      : [{ type: "scene_heading" as ElementType, text: "" }];
    for (const el of els) appendElement(arr, el);
  }, LOCAL_ORIGIN);
}

export interface ReadElement extends ScreenplayElement {
  id: string;
}

/** Read the elements as plain objects (with stable ids for React keys). */
export function readElements(doc: Y.Doc): ReadElement[] {
  return elementsArray(doc)
    .toArray()
    .map((m) => {
      const el: ReadElement = {
        id: (m.get("id") as string) ?? makeId(),
        type: (m.get("type") as ElementType) ?? "action",
        text: (m.get("text") as Y.Text)?.toString() ?? "",
      };
      const sceneNumber = m.get("sceneNumber") as string | undefined;
      const dual = m.get("dual") as "left" | "right" | undefined;
      const depth = m.get("depth") as number | undefined;
      if (sceneNumber) el.sceneNumber = sceneNumber;
      if (dual) el.dual = dual;
      if (typeof depth === "number") el.depth = depth;
      return el;
    });
}

/** Read the title page as a plain object. */
export function readTitlePage(doc: Y.Doc): TitlePage {
  const tp = titlePageMap(doc);
  const out: Record<string, string> = {};
  tp.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out as TitlePage;
}

/** Read the whole document as a Screenplay. */
export function readScreenplay(doc: Y.Doc): Screenplay {
  return { titlePage: readTitlePage(doc), elements: readElements(doc) };
}

/**
 * Apply a new text value to an element's Y.Text using a minimal prefix/suffix
 * diff, so concurrent edits at different offsets merge instead of overwriting.
 */
export function setElementText(doc: Y.Doc, index: number, next: string): void {
  const arr = elementsArray(doc);
  const map = arr.get(index);
  if (!map) return;
  const ytext = map.get("text") as Y.Text;
  const cur = ytext.toString();
  if (cur === next) return;

  let start = 0;
  const minLen = Math.min(cur.length, next.length);
  while (start < minLen && cur[start] === next[start]) start++;
  let endCur = cur.length;
  let endNext = next.length;
  while (endCur > start && endNext > start && cur[endCur - 1] === next[endNext - 1]) {
    endCur--;
    endNext--;
  }
  doc.transact(() => {
    if (endCur - start > 0) ytext.delete(start, endCur - start);
    const insertStr = next.slice(start, endNext);
    if (insertStr) ytext.insert(start, insertStr);
  }, LOCAL_ORIGIN);
}

/** Set a scalar field (e.g. type) on an element. */
export function setElementField(
  doc: Y.Doc,
  index: number,
  key: "type" | "sceneNumber" | "dual" | "depth",
  value: unknown,
): void {
  const map = elementsArray(doc).get(index);
  if (!map) return;
  doc.transact(() => map.set(key, value), LOCAL_ORIGIN);
}

/** Set a title-page metadata field. */
export function setTitleField(doc: Y.Doc, key: string, value: string): void {
  doc.transact(() => titlePageMap(doc).set(key, value), LOCAL_ORIGIN);
}
