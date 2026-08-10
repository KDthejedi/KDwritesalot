import { NextResponse } from "next/server";
import { withUser } from "@/lib/api/handler";
import {
  addCollaborator,
  listCollaborators,
  removeCollaborator,
} from "@/lib/screenplays/service";
import type { Role } from "@/lib/store/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ASSIGNABLE: Role[] = ["EDITOR", "COMMENTER", "VIEWER"];

export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const items = await listCollaborators(id, user.id);
    return NextResponse.json({ items });
  });
}

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const body = (await request.json()) as { email?: string; role?: Role };
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role;
    if (!email || !role || !ASSIGNABLE.includes(role)) {
      return NextResponse.json({ error: "email and a valid role are required" }, { status: 400 });
    }
    const collaborator = await addCollaborator(id, user.id, email, role as Exclude<Role, "OWNER">);
    return NextResponse.json(collaborator, { status: 201 });
  });
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params;
  return withUser(async (user) => {
    const collaboratorId = new URL(request.url).searchParams.get("collaboratorId");
    if (!collaboratorId) {
      return NextResponse.json({ error: "collaboratorId is required" }, { status: 400 });
    }
    await removeCollaborator(id, user.id, collaboratorId);
    return NextResponse.json({ ok: true });
  });
}
