import { describe, expect, it } from "vitest";
import { toFdx } from "./fdx";
import type { Screenplay } from "../screenplay/types";

const doc: Screenplay = {
  titlePage: { title: "The Long Drive", author: "Jane Writer" },
  elements: [
    { type: "scene_heading", text: "INT. CAR - NIGHT", sceneNumber: "1" },
    { type: "action", text: 'Rain & "wind" hammer the <windshield>.' },
    { type: "character", text: "SAM" },
    { type: "parenthetical", text: "(quietly)" },
    { type: "dialogue", text: "We should have turned back." },
    { type: "transition", text: "CUT TO:" },
    { type: "centered", text: "THE END" },
    { type: "section", text: "Act One", depth: 1 },
    { type: "page_break", text: "" },
  ],
};

describe("FDX export", () => {
  const fdx = toFdx(doc);

  it("produces an FDX document header", () => {
    expect(fdx).toContain('<?xml version="1.0"');
    expect(fdx).toContain('<FinalDraft DocumentType="Script"');
    expect(fdx).toContain("<Content>");
  });

  it("maps element types to Final Draft paragraph types", () => {
    expect(fdx).toContain('<Paragraph Type="Scene Heading">');
    expect(fdx).toContain('<Paragraph Type="Action">');
    expect(fdx).toContain('<Paragraph Type="Character">');
    expect(fdx).toContain('<Paragraph Type="Parenthetical">');
    expect(fdx).toContain('<Paragraph Type="Dialogue">');
    expect(fdx).toContain('<Paragraph Type="Transition">');
  });

  it("escapes XML special characters", () => {
    expect(fdx).toContain("Rain &amp; &quot;wind&quot; hammer the &lt;windshield&gt;.");
    expect(fdx).not.toContain('hammer the <windshield>');
  });

  it("includes scene numbers and centered alignment", () => {
    expect(fdx).toContain('<SceneProperties Number="1"/>');
    expect(fdx).toContain('Alignment="Center"');
  });

  it("omits outline sections and represents page breaks", () => {
    expect(fdx).not.toContain("Act One");
    expect(fdx).toContain('StartsNewPage="Yes"');
  });

  it("includes a title page", () => {
    expect(fdx).toContain("<TitlePage>");
    expect(fdx).toContain("The Long Drive");
    expect(fdx).toContain("Jane Writer");
  });
});
