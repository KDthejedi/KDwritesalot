/**
 * Hocuspocus real-time collaboration server (standalone process).
 *
 * Run alongside the Next.js app:
 *   node --env-file=.env collab-server/server.mjs
 *
 * Responsibilities:
 *  - Authenticate each connection by verifying the JWT minted at
 *    /api/collab-token (same AUTH_SECRET). The token binds a user to one
 *    screenplay (document) and role.
 *  - Enforce read-only access for VIEWER/COMMENTER roles.
 *  - Persist the Yjs document to Postgres (CollabDoc table) so the shared
 *    document survives everyone disconnecting.
 */

import { Server } from "@hocuspocus/server";
import { Database } from "@hocuspocus/extension-database";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";

const prisma = new PrismaClient();
const PORT = Number(process.env.COLLAB_PORT ?? 1234);
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");

const server = new Server({
  port: PORT,

  async onAuthenticate({ token, documentName, connection }) {
    if (!token) throw new Error("Missing token");
    const { payload } = await jwtVerify(token, secret);
    if (payload.screenplayId !== documentName) {
      throw new Error("Token does not match document");
    }
    const role = payload.role;
    if (!role) throw new Error("No access");

    // VIEWER and COMMENTER cannot mutate the shared document.
    if (role === "VIEWER" || role === "COMMENTER") {
      connection.readOnly = true;
    }
    return { userId: payload.sub, name: payload.name, role };
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const row = await prisma.collabDoc.findUnique({ where: { name: documentName } });
        return row?.state ? new Uint8Array(row.state) : null;
      },
      store: async ({ documentName, state }) => {
        await prisma.collabDoc.upsert({
          where: { name: documentName },
          update: { state },
          create: { name: documentName, state },
        });
      },
    }),
  ],
});

server.listen().then(() => {
  console.log(`Hocuspocus collaboration server listening on ws://localhost:${PORT}`);
});
