import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AccessError } from "@/lib/screenplays/service";

export interface ActingUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

/**
 * Wrap an API handler with authentication and consistent error mapping. The
 * callback only runs for a signed-in user; AccessError from the service layer
 * becomes the right 403/404 response.
 */
export async function withUser(
  fn: (user: ActingUser) => Promise<Response>,
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await fn(session.user);
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("API error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
