import type { CSSProperties } from "react";
import type { ElementType } from "@/lib/screenplay/types";

/**
 * On-screen geometry for each element, expressed relative to the page's text
 * area (which begins at the 1.5" left margin). Values are in `ch` units so they
 * line up with the Courier monospace font — 10 characters per inch means one
 * inch of indent is 10ch. This mirrors the print geometry in lib/export/layout.
 */
export const ELEMENT_STYLE: Record<ElementType, CSSProperties> = {
  scene_heading: { marginLeft: "0ch", width: "60ch", textTransform: "uppercase", fontWeight: 700 },
  action: { marginLeft: "0ch", width: "60ch" },
  character: { marginLeft: "22ch", width: "33ch", textTransform: "uppercase" },
  parenthetical: { marginLeft: "16ch", width: "20ch", fontStyle: "italic" },
  dialogue: { marginLeft: "10ch", width: "35ch" },
  transition: { marginLeft: "45ch", width: "15ch", textTransform: "uppercase", textAlign: "right" },
  shot: { marginLeft: "0ch", width: "60ch", textTransform: "uppercase" },
  centered: { marginLeft: "0ch", width: "60ch", textAlign: "center" },
  section: { marginLeft: "0ch", width: "60ch", color: "#9333ea", fontWeight: 700 },
  synopsis: { marginLeft: "0ch", width: "60ch", color: "#6b7280", fontStyle: "italic" },
  page_break: { marginLeft: "0ch", width: "60ch", textAlign: "center", color: "#9ca3af" },
};
