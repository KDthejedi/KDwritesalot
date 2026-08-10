/**
 * PDF export.
 *
 * Renders a screenplay to an industry-standard PDF: US Letter, Courier 12pt,
 * with a title page built from the document metadata. All positioning comes
 * from the pure {@link layoutScreenplay} geometry; this module only draws.
 * Courier is one of the 14 standard PDF fonts, so nothing needs to be embedded.
 */

import PDFDocument from "pdfkit";
import { PAGE, layoutScreenplay } from "./layout";
import type { Screenplay } from "../screenplay/types";

const POINTS_PER_INCH = 72;
const FONT_SIZE = 12;

function inToPt(inches: number): number {
  return inches * POINTS_PER_INCH;
}

/** Render a screenplay to a PDF and resolve with the complete file buffer. */
export function toPdf(doc: Screenplay): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const info: PDFKit.DocumentInfo = {
      Title: doc.titlePage.title ?? "Untitled Screenplay",
    };
    if (doc.titlePage.author) info.Author = doc.titlePage.author;

    const pdf = new PDFDocument({
      size: "letter",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
      info,
    });

    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    pdf.font("Courier").fontSize(FONT_SIZE);

    renderTitlePage(pdf, doc);

    const pages = layoutScreenplay(doc);
    for (const page of pages) {
      pdf.addPage();
      for (const line of page) {
        const x = inToPt(line.xIn);
        const y = inToPt(PAGE.topMarginIn) + (line.lineIndex / PAGE.linesPerInch) * POINTS_PER_INCH;
        pdf.text(line.text, x, y, { lineBreak: false });
      }
    }

    // Ensure at least one page exists for an empty screenplay.
    if (pages.length === 0) pdf.addPage();

    pdf.end();
  });
}

function renderTitlePage(pdf: PDFKit.PDFDocument, doc: Screenplay): void {
  const tp = doc.titlePage;
  if (!tp.title && !tp.author && !tp.credit) return;

  pdf.addPage();
  const centerWidth = inToPt(PAGE.widthIn) - inToPt(3.0);
  const left = inToPt(1.5);

  // Title block, roughly centered vertically.
  let y = inToPt(3.5);
  const centered = (text: string, gap = 24) => {
    pdf.text(text, left, y, { width: centerWidth, align: "center", lineBreak: true });
    y += gap;
  };

  if (tp.title) centered(tp.title.toUpperCase(), 36);
  if (tp.credit) centered(tp.credit, 20);
  if (tp.author) centered(tp.author, 28);
  if (tp.source) centered(tp.source, 24);

  // Lower-left contact / copyright block.
  let by = inToPt(PAGE.heightIn) - inToPt(2.0);
  const bottomLeft = (text: string) => {
    pdf.text(text, left, by, { width: centerWidth, lineBreak: true });
    by += 16;
  };
  if (tp.draftDate) bottomLeft(tp.draftDate);
  if (tp.contact) bottomLeft(tp.contact);
  if (tp.copyright) bottomLeft(tp.copyright);
}
