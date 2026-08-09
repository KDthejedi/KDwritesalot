import { NextResponse } from "next/server";
import { toPdf } from "@/lib/export/pdf";
import type { Screenplay } from "@/lib/screenplay/types";
import { safeFilename } from "@/lib/export/filename";

// pdfkit requires the Node.js runtime (not Edge).
export const runtime = "nodejs";

export async function POST(request: Request) {
  let doc: Screenplay;
  try {
    doc = (await request.json()) as Screenplay;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!doc || !Array.isArray(doc.elements)) {
    return NextResponse.json({ error: "Body must be a Screenplay" }, { status: 400 });
  }

  const pdf = await toPdf(doc);
  const name = safeFilename(doc.titlePage?.title ?? "screenplay", "pdf");
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
