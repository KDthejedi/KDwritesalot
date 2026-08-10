import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sha256Hex } from "./sha256";

describe("sha256Hex", () => {
  it("matches known test vectors", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches node's crypto for longer and unicode input", () => {
    const samples = [
      "The quick brown fox jumps over the lazy dog",
      "a".repeat(1000),
      "INT. CAFÉ – DAY\n\nSAM\nHellø, wörld! 😀",
    ];
    for (const s of samples) {
      const expected = createHash("sha256").update(s, "utf8").digest("hex");
      expect(sha256Hex(s)).toBe(expected);
    }
  });
});
