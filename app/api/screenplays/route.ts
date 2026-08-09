import { NextResponse } from "next/server";
import { withUser } from "@/lib/api/handler";
import { create, listForUser } from "@/lib/screenplays/service";
import type { Screenplay } from "@/lib/screenplay/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return withUser(async (user) => {
    const items = await listForUser(user.id);
    return NextResponse.json({ items });
  });
}

export async function POST(request: Request) {
  return withUser(async (user) => {
    let doc: Screenplay | undefined;
    try {
      const body = await request.json();
      doc = body?.doc as Screenplay | undefined;
    } catch {
      // No body — create an empty screenplay.
    }
    const record = await create(user.id, doc);
    return NextResponse.json(record, { status: 201 });
  });
}
