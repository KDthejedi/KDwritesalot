import { describe, expect, it } from "vitest";
import {
  buildProvenanceRecord,
  createRevision,
  hashScreenplay,
  verifyChain,
  type Revision,
} from "./provenance";
import type { Screenplay } from "./screenplay/types";

const docA: Screenplay = {
  titlePage: { title: "A" },
  elements: [{ type: "action", text: "Hello." }],
};
const docB: Screenplay = {
  titlePage: { title: "A" },
  elements: [{ type: "action", text: "Goodbye." }],
};

describe("hashing", () => {
  it("is deterministic for identical documents", () => {
    expect(hashScreenplay(docA)).toBe(hashScreenplay(docA));
  });

  it("differs for different documents", () => {
    expect(hashScreenplay(docA)).not.toBe(hashScreenplay(docB));
  });

  it("produces a 64-char hex SHA-256 digest", () => {
    expect(hashScreenplay(docA)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("revision chain", () => {
  const r1 = createRevision(docA, {
    id: "r1",
    screenplayId: "s1",
    authorId: "u1",
    authorName: "Jane",
    createdAt: "2026-08-09T10:00:00.000Z",
    label: "First Draft",
  }, null);

  const r2 = createRevision(docB, {
    id: "r2",
    screenplayId: "s1",
    authorId: "u1",
    authorName: "Jane",
    createdAt: "2026-08-09T11:00:00.000Z",
  }, r1);

  it("links each revision to the previous via chainHash", () => {
    expect(r1.chainHash).not.toBe(r2.chainHash);
    expect(verifyChain([r1, r2])).toBe(true);
  });

  it("detects tampering with a revision's content", () => {
    const tampered: Revision = { ...r2, contentHash: "0".repeat(64) };
    expect(verifyChain([r1, tampered])).toBe(false);
  });

  it("builds a provenance record with a validity flag", () => {
    const record = buildProvenanceRecord(
      { screenplayId: "s1", title: "A", author: "Jane", generatedAt: "2026-08-09T12:00:00.000Z" },
      [r1, r2],
    );
    expect(record.chainValid).toBe(true);
    expect(record.revisions).toHaveLength(2);
    expect(record.revisions[0].label).toBe("First Draft");
    expect(record.revisions[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
