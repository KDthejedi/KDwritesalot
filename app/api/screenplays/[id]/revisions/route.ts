import { NextResponse } from "next/server";
import { withUser } from "@/lib/api/handler";
import { addRevision, getWithAccess } from "@/lib/screenplays/service";
import type { Screenplay } from "@/lib/screenplay/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const record = await getWithAccess(id, user.id);
    return NextResponse.json({ revisions: record.revisions });
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const body = (await request.json()) as {
      doc?: Screenplay;
      label?: string;
      message?: string;
    };
    if (!body?.doc || !Array.isArray(body.doc.elements)) {
      return NextResponse.json({ error: "Body must include a Screenplay doc" }, { status: 400 });
    }
    const revision = await addRevision(id, user.id, body.doc, {
      label: body.label?.trim() || undefined,
      message: body.message?.trim() || undefined,
      authorName: user.name ?? undefined,
    });
    return NextResponse.json(revision, { status: 201 });
  });
}
