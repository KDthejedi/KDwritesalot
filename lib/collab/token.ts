/**
 * Short-lived collaboration tokens.
 *
 * The browser can't hand its session cookie to the WebSocket server, so it
 * fetches a signed JWT (from /api/collab-token) and passes it to Hocuspocus.
 * The token binds a user to one screenplay + role; the collab server verifies
 * it with the same AUTH_SECRET and enforces read-only for non-editors.
 */

import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/store/types";

export interface CollabClaims {
  sub: string; // user id
  name?: string;
  screenplayId: string;
  role: Role;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signCollabToken(claims: CollabClaims): Promise<string> {
  return new SignJWT({
    name: claims.name,
    screenplayId: claims.screenplayId,
    role: claims.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey());
}

export async function verifyCollabToken(token: string): Promise<CollabClaims> {
  const { payload } = await jwtVerify(token, secretKey());
  return {
    sub: String(payload.sub),
    name: payload.name as string | undefined,
    screenplayId: payload.screenplayId as string,
    role: payload.role as Role,
  };
}
