import { describe, expect, it } from "vitest";
import {
  collectCharacterNames,
  cycleType,
  formatText,
  nextTypeOnEnter,
  suggestCompletions,
} from "./behaviors";

describe("nextTypeOnEnter", () => {
  it("follows Final Draft flow", () => {
    expect(nextTypeOnEnter("scene_heading")).toBe("action");
    expect(nextTypeOnEnter("character")).toBe("dialogue");
    expect(nextTypeOnEnter("parenthetical")).toBe("dialogue");
    expect(nextTypeOnEnter("dialogue")).toBe("character");
    expect(nextTypeOnEnter("transition")).toBe("scene_heading");
    expect(nextTypeOnEnter("action")).toBe("action");
  });
});

describe("cycleType", () => {
  it("cycles forward and wraps", () => {
    expect(cycleType("scene_heading")).toBe("action");
    expect(cycleType("transition")).toBe("scene_heading");
  });
  it("cycles backward", () => {
    expect(cycleType("action", -1)).toBe("scene_heading");
    expect(cycleType("scene_heading", -1)).toBe("transition");
  });
});

describe("formatText", () => {
  it("uppercases headings, characters, transitions", () => {
    expect(formatText("scene_heading", "int. house - day")).toBe("INT. HOUSE - DAY");
    expect(formatText("character", "jane")).toBe("JANE");
    expect(formatText("transition", "cut to:")).toBe("CUT TO:");
  });
  it("wraps parentheticals", () => {
    expect(formatText("parenthetical", "whispering")).toBe("(whispering)");
    expect(formatText("parenthetical", "(already)")).toBe("(already)");
    expect(formatText("parenthetical", "")).toBe("");
  });
  it("leaves action and dialogue unchanged", () => {
    expect(formatText("action", "A quiet Room.")).toBe("A quiet Room.");
    expect(formatText("dialogue", "Hello There.")).toBe("Hello There.");
  });
});

describe("suggestCompletions", () => {
  it("suggests scene heading prefixes", () => {
    expect(suggestCompletions("scene_heading", "IN")).toContain("INT. ");
  });
  it("suggests known locations after a prefix", () => {
    const out = suggestCompletions("scene_heading", "INT. KIT", { locations: ["KITCHEN", "KING'S ROOM"] });
    expect(out).toContain("INT. KITCHEN");
  });
  it("suggests known character names", () => {
    const out = suggestCompletions("character", "JA", { characters: ["JANE", "JACK", "SAM"] });
    expect(out).toEqual(["JANE", "JACK"]);
  });
});

describe("collectCharacterNames", () => {
  it("collects distinct names, stripping extensions", () => {
    const names = collectCharacterNames([
      { type: "character", text: "JANE" },
      { type: "dialogue", text: "Hi" },
      { type: "character", text: "JANE (V.O.)" },
      { type: "character", text: "SAM" },
    ]);
    expect(names).toEqual(["JANE", "SAM"]);
  });
});
