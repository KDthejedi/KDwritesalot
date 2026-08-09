/**
 * Provenance: the authorship trail that makes a screenplay "copyright-ready".
 *
 * The app cannot register a copyright for the user (the U.S. Copyright Office
 * and WGA have no public API), but it can build strong supporting evidence of
 * authorship over time: every saved revision is timestamped and fingerprinted
 * with a SHA-256 hash of its canonical text. A tamper-evident chain of these
 * hashes, exported as a provenance record, documents what existed and when.
 */

import { createHash } from "node:crypto";
import { serialize } from "./screenplay/fountain";
import type { Screenplay } from "./screenplay/types";

/** The canonical text form of a screenplay used for hashing (Fountain). */
export function canonicalText(doc: Screenplay): string {
  return serialize(doc);
}

/** SHA-256 hex digest of the screenplay's canonical text. */
export function hashScreenplay(doc: Screenplay): string {
  return sha256(canonicalText(doc));
}

/** SHA-256 hex digest of an arbitrary string. */
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** A single immutable revision in a screenplay's history. */
export interface Revision {
  id: string;
  screenplayId: string;
  authorId: string;
  authorName?: string;
  /** ISO-8601 timestamp of when the revision was recorded. */
  createdAt: string;
  /** SHA-256 of the canonical text at this revision. */
  contentHash: string;
  /** Optional human label ("First Draft", "Production Draft"). */
  label?: string;
  /** Optional commit-style message describing the change. */
  message?: string;
  /**
   * Hash of the previous revision's contentHash + this contentHash, forming a
   * tamper-evident chain. Null for the first revision.
   */
  chainHash: string;
}

export interface NewRevisionInput {
  id: string;
  screenplayId: string;
  authorId: string;
  authorName?: string;
  createdAt: string;
  label?: string;
  message?: string;
}

/**
 * Build an immutable revision for a screenplay state, linking it to the
 * previous revision to form a hash chain. `previous` is the most recent
 * existing revision, or null for the first.
 */
export function createRevision(
  doc: Screenplay,
  input: NewRevisionInput,
  previous: Revision | null,
): Revision {
  const contentHash = hashScreenplay(doc);
  const chainHash = sha256((previous?.chainHash ?? "") + contentHash);
  return {
    ...input,
    contentHash,
    chainHash,
  };
}

/** A structured record documenting a screenplay's full authorship trail. */
export interface ProvenanceRecord {
  screenplayId: string;
  title: string;
  author?: string;
  generatedAt: string;
  /** Whether the recorded hash chain is internally consistent. */
  chainValid: boolean;
  revisions: Array<{
    createdAt: string;
    authorName?: string;
    label?: string;
    message?: string;
    contentHash: string;
    chainHash: string;
  }>;
}

/**
 * Verify that a list of revisions (oldest first) forms an unbroken hash chain.
 * Returns true if every revision's chainHash matches the recomputed value.
 */
export function verifyChain(revisions: Revision[]): boolean {
  let prev = "";
  for (const rev of revisions) {
    const expected = sha256(prev + rev.contentHash);
    if (expected !== rev.chainHash) return false;
    prev = rev.chainHash;
  }
  return true;
}

/** Build a provenance record (oldest revision first). */
export function buildProvenanceRecord(
  meta: { screenplayId: string; title: string; author?: string; generatedAt: string },
  revisions: Revision[],
): ProvenanceRecord {
  return {
    screenplayId: meta.screenplayId,
    title: meta.title,
    author: meta.author,
    generatedAt: meta.generatedAt,
    chainValid: verifyChain(revisions),
    revisions: revisions.map((r) => ({
      createdAt: r.createdAt,
      authorName: r.authorName,
      label: r.label,
      message: r.message,
      contentHash: r.contentHash,
      chainHash: r.chainHash,
    })),
  };
}
