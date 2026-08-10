import { NextResponse } from "next/server";
import { withUser } from "@/lib/api/handler";
import { getRole } from "@/lib/screenplays/service";
import { signCollabToken } from "@/lib/collab/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withUser(async (user) => {
    const { screenplayId } = (await request.json()) as { screenplayId?: string };
    if (!screenplayId) {
      return NextResponse.json({ error: "screenplayId required" }, { status: 400 });
    }
    const role = await getRole(screenplayId, user.id);
    if (!role) return NextResponse.json({ error: "No access" }, { status: 404 });

    const token = await signCollabToken({
      sub: user.id,
      name: user.name ?? user.email ?? "Writer",
      screenplayId,
      role,
    });
    const url = process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://localhost:1234";
    return NextResponse.json({ token, url, role, name: user.name ?? user.email ?? "Writer" });
  });
}
