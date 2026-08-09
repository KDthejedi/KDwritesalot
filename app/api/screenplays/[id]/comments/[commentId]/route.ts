import { NextResponse } from "next/server";
import { withUser } from "@/lib/api/handler";
import { deleteComment, setCommentResolved } from "@/lib/screenplays/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id, commentId } = await params;
  return withUser(async (user) => {
    const body = (await request.json()) as { resolved?: boolean };
    await setCommentResolved(id, user.id, commentId, Boolean(body.resolved));
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id, commentId } = await params;
  return withUser(async (user) => {
    await deleteComment(id, user.id, commentId);
    return NextResponse.json({ ok: true });
  });
}
