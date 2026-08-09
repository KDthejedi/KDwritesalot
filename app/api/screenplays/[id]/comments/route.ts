import { NextResponse } from "next/server";
import { withUser } from "@/lib/api/handler";
import { addComment, listComments } from "@/lib/screenplays/service";
import type { CommentAnchor } from "@/lib/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const items = await listComments(id, user.id);
    return NextResponse.json({ items });
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const body = (await request.json()) as {
      body?: string;
      anchor?: CommentAnchor | null;
      threadId?: string | null;
    };
    if (!body?.body?.trim()) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }
    const comment = await addComment(id, user.id, {
      body: body.body,
      anchor: body.anchor ?? null,
      threadId: body.threadId ?? null,
    });
    return NextResponse.json(comment, { status: 201 });
  });
}
