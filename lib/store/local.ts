/**
 * Local (browser) persistence for screenplays.
 *
 * This is the zero-config store: screenplays live in localStorage so the app is
 * fully usable with no database or login. The cloud phase (Prisma + Auth.js)
 * swaps this out for an API-backed store with the same shape, so the UI does not
 * need to change. All functions are no-ops on the server (no localStorage).
 */

import { emptyScreenplay } from "@/lib/screenplay/types";
import type { ScreenplaySummary, StoredScreenplay } from "./types";

export type { ScreenplaySummary, StoredScreenplay } from "./types";

const INDEX_KEY = "kd:index";
const docKey = (id: string) => `kd:doc:${id}`;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readIndex(): ScreenplaySummary[] {
  if (!hasStorage()) return [];
  try {
    return JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeIndex(index: ScreenplaySummary[]): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

/** Generate a URL-safe unique id (uuid when available, else a random string). */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** List screenplays, most recently updated first. */
export function listScreenplays(): ScreenplaySummary[] {
  return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Load a full screenplay by id, or null if not found. */
export function getScreenplay(id: string): StoredScreenplay | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(docKey(id));
    return raw ? (JSON.parse(raw) as StoredScreenplay) : null;
  } catch {
    return null;
  }
}

/** Create a new, empty screenplay and return it. */
export function createScreenplay(title = "Untitled Screenplay"): StoredScreenplay {
  const now = new Date().toISOString();
  const doc = emptyScreenplay();
  doc.titlePage.title = title;
  const record: StoredScreenplay = {
    id: newId(),
    title,
    createdAt: now,
    updatedAt: now,
    doc,
    revisions: [],
  };
  saveScreenplay(record);
  return record;
}

/** Persist a screenplay (updates the index). */
export function saveScreenplay(record: StoredScreenplay): void {
  if (!hasStorage()) return;
  record.updatedAt = new Date().toISOString();
  record.title = record.doc.titlePage.title?.trim() || "Untitled Screenplay";
  window.localStorage.setItem(docKey(record.id), JSON.stringify(record));
  const index = readIndex().filter((s) => s.id !== record.id);
  index.push({ id: record.id, title: record.title, updatedAt: record.updatedAt });
  writeIndex(index);
}

/** Delete a screenplay by id. */
export function deleteScreenplay(id: string): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(docKey(id));
  writeIndex(readIndex().filter((s) => s.id !== id));
}
