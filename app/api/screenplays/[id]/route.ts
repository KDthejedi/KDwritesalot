import { NextResponse } from "next/server";
import { withUser } from "@/lib/api/handler";
import { getWithAccess, remove, update } from "@/lib/screenplays/service";
import type { Screenplay } from "@/lib/screenplay/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const record = await getWithAccess(id, user.id);
    return NextResponse.json(record);
  });
}

export async function PUT(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const body = (await request.json()) as { doc?: Screenplay };
    if (!body?.doc || !Array.isArray(body.doc.elements)) {
      return NextResponse.json({ error: "Body must include a Screenplay doc" }, { status: 400 });
    }
    await update(id, user.id, body.doc);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    await remove(id, user.id);
    return NextResponse.json({ ok: true });
  });
}
