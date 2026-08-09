import { NextResponse } from "next/server";
import { toFdx } from "@/lib/export/fdx";
import { safeFilename } from "@/lib/export/filename";
import type { Screenplay } from "@/lib/screenplay/types";
import { withUser } from "@/lib/api/handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return withUser(async () => {
    let doc: Screenplay;
    try {
      doc = (await request.json()) as Screenplay;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!doc || !Array.isArray(doc.elements)) {
      return NextResponse.json({ error: "Body must be a Screenplay" }, { status: 400 });
    }

    const fdx = toFdx(doc);
    const name = safeFilename(doc.titlePage?.title ?? "screenplay", "fdx");
    return new NextResponse(fdx, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  });
}
