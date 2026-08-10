/**
 * Final Draft (`.fdx`) export.
 *
 * FDX is Final Draft's XML interchange format. It is what most of the industry
 * imports, so generating valid FDX lets a writer take their screenplay into
 * Final Draft, WriterDuet, and similar tools. We build it directly from the
 * screenplay AST.
 */

import type { Screenplay, ScreenplayElement } from "../screenplay/types";

/** Map our element types to Final Draft paragraph type names. */
const FDX_TYPE: Partial<Record<ScreenplayElement["type"], string>> = {
  scene_heading: "Scene Heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
  shot: "Shot",
  centered: "Action",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraph(type: string, text: string, attrs = ""): string {
  return (
    `    <Paragraph Type="${type}"${attrs}>\n` +
    `      <Text>${escapeXml(text)}</Text>\n` +
    `    </Paragraph>`
  );
}

function titlePageXml(doc: Screenplay): string {
  const tp = doc.titlePage;
  const lines: string[] = [];
  const center = (t: string) =>
    `    <Paragraph Alignment="Center">\n      <Text>${escapeXml(t)}</Text>\n    </Paragraph>`;
  if (tp.title) lines.push(center(tp.title));
  if (tp.credit) lines.push(center(tp.credit));
  if (tp.author) lines.push(center(tp.author));
  if (tp.source) lines.push(center(tp.source));
  if (tp.draftDate) lines.push(center(tp.draftDate));
  if (tp.contact) lines.push(center(tp.contact));
  if (tp.copyright) lines.push(center(tp.copyright));
  if (lines.length === 0) return "";
  return `  <TitlePage>\n    <Content>\n${lines.join("\n")}\n    </Content>\n  </TitlePage>\n`;
}

/** Serialize a screenplay to a Final Draft `.fdx` document string. */
export function toFdx(doc: Screenplay): string {
  const paras: string[] = [];

  for (const el of doc.elements) {
    // Outline-only and non-printing elements are omitted from script content.
    if (el.type === "section" || el.type === "synopsis") continue;

    // Page breaks are represented by starting the next paragraph on a new page.
    if (el.type === "page_break") {
      paras.push('    <Paragraph Type="Action" StartsNewPage="Yes">\n      <Text></Text>\n    </Paragraph>');
      continue;
    }

    const type = FDX_TYPE[el.type] ?? "Action";
    const attrs = el.type === "centered" ? ' Alignment="Center"' : "";
    let para = paragraph(type, el.text, attrs);

    if (el.type === "scene_heading" && el.sceneNumber) {
      para =
        `    <Paragraph Type="Scene Heading">\n` +
        `      <SceneProperties Number="${escapeXml(el.sceneNumber)}"/>\n` +
        `      <Text>${escapeXml(el.text)}</Text>\n` +
        `    </Paragraph>`;
    }
    paras.push(para);
  }

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n` +
    `<FinalDraft DocumentType="Script" Template="No" Version="5">\n` +
    `  <Content>\n` +
    paras.join("\n") +
    `\n  </Content>\n` +
    titlePageXml(doc) +
    `</FinalDraft>\n`
  );
}
