/**
 * Server-side screenplay service. This is the security boundary: every function
 * takes the acting user's id and enforces their role before reading or writing.
 * API routes call these; nothing else touches the database for screenplays.
 */

import { prisma } from "@/lib/prisma";
import { createRevision, type Revision as ProvRevision } from "@/lib/provenance";
import { emptyScreenplay, type Screenplay } from "@/lib/screenplay/types";
import type {
  CollaboratorInfo,
  Role,
  ScreenplaySummary,
  StoredScreenplay,
} from "@/lib/store/types";

export class AccessError extends Error {
  constructor(
    public status: 403 | 404,
    message: string,
  ) {
    super(message);
  }
}

/** Public wrapper: the acting user's role for a screenplay, or null. */
export async function getRole(screenplayId: string, userId: string): Promise<Role | null> {
  return resolveRole(screenplayId, userId);
}

/** Resolve the acting user's role for a screenplay, or null if no access. */
async function resolveRole(screenplayId: string, userId: string): Promise<Role | null> {
  const s = await prisma.screenplay.findUnique({
    where: { id: screenplayId },
    select: { ownerId: true, collaborators: { where: { userId }, select: { role: true } } },
  });
  if (!s) return null;
  if (s.ownerId === userId) return "OWNER";
  return s.collaborators[0]?.role ?? null;
}

function toProvRevision(r: {
  id: string;
  screenplayId: string;
  authorId: string;
  createdAt: Date;
  contentHash: string;
  chainHash: string;
  label: string | null;
  message: string | null;
  author?: { name: string | null } | null;
}): ProvRevision {
  return {
    id: r.id,
    screenplayId: r.screenplayId,
    authorId: r.authorId,
    authorName: r.author?.name ?? undefined,
    createdAt: r.createdAt.toISOString(),
    contentHash: r.contentHash,
    chainHash: r.chainHash,
    label: r.label ?? undefined,
    message: r.message ?? undefined,
  };
}

/** List screenplays the user owns or collaborates on, newest first. */
export async function listForUser(userId: string): Promise<ScreenplaySummary[]> {
  const rows = await prisma.screenplay.findMany({
    where: { OR: [{ ownerId: userId }, { collaborators: { some: { userId } } }] },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      ownerId: true,
      collaborators: { where: { userId }, select: { role: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
    role: r.ownerId === userId ? "OWNER" : (r.collaborators[0]?.role ?? "VIEWER"),
  }));
}

/** Create a new screenplay owned by the user. */
export async function create(userId: string, doc?: Screenplay): Promise<StoredScreenplay> {
  const content = doc ?? emptyScreenplay();
  const title = content.titlePage.title?.trim() || "Untitled Screenplay";
  const row = await prisma.screenplay.create({
    data: { title, ownerId: userId, content: content as object },
  });
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    doc: content,
    revisions: [],
    role: "OWNER",
  };
}

/** Load a screenplay the user can access (any role), with its revisions. */
export async function getWithAccess(id: string, userId: string): Promise<StoredScreenplay> {
  const role = await resolveRole(id, userId);
  if (role === null) throw new AccessError(404, "Not found");
  const row = await prisma.screenplay.findUniqueOrThrow({
    where: { id },
    include: { revisions: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } } },
  });
  return {
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    doc: row.content as unknown as Screenplay,
    revisions: row.revisions.map(toProvRevision),
    role,
  };
}

/** Save the document (OWNER or EDITOR only). */
export async function update(id: string, userId: string, doc: Screenplay): Promise<void> {
  const role = await resolveRole(id, userId);
  if (role === null) throw new AccessError(404, "Not found");
  if (role !== "OWNER" && role !== "EDITOR") throw new AccessError(403, "Read-only access");
  const title = doc.titlePage.title?.trim() || "Untitled Screenplay";
  await prisma.screenplay.update({
    where: { id },
    data: { content: doc as object, title },
  });
}

/** Delete a screenplay (OWNER only). */
export async function remove(id: string, userId: string): Promise<void> {
  const role = await resolveRole(id, userId);
  if (role === null) throw new AccessError(404, "Not found");
  if (role !== "OWNER") throw new AccessError(403, "Only the owner can delete");
  await prisma.screenplay.delete({ where: { id } });
}

/** Append an immutable revision to the provenance trail (OWNER or EDITOR). */
export async function addRevision(
  id: string,
  userId: string,
  doc: Screenplay,
  meta: { label?: string; message?: string; authorName?: string },
): Promise<ProvRevision> {
  const role = await resolveRole(id, userId);
  if (role === null) throw new AccessError(404, "Not found");
  if (role !== "OWNER" && role !== "EDITOR") throw new AccessError(403, "Read-only access");

  const last = await prisma.revision.findFirst({
    where: { screenplayId: id },
    orderBy: { createdAt: "desc" },
  });
  const previous: ProvRevision | null = last
    ? {
        id: last.id,
        screenplayId: last.screenplayId,
        authorId: last.authorId,
        createdAt: last.createdAt.toISOString(),
        contentHash: last.contentHash,
        chainHash: last.chainHash,
      }
    : null;

  const computed = createRevision(
    doc,
    {
      id: "pending",
      screenplayId: id,
      authorId: userId,
      authorName: meta.authorName,
      createdAt: new Date().toISOString(),
      label: meta.label,
      message: meta.message,
    },
    previous,
  );

  const row = await prisma.revision.create({
    data: {
      screenplayId: id,
      authorId: userId,
      snapshot: doc as object,
      contentHash: computed.contentHash,
      chainHash: computed.chainHash,
      label: meta.label ?? null,
      message: meta.message ?? null,
    },
    include: { author: { select: { name: true } } },
  });
  return toProvRevision(row);
}

// --- Collaborators -----------------------------------------------------------

export async function listCollaborators(id: string, userId: string): Promise<CollaboratorInfo[]> {
  const role = await resolveRole(id, userId);
  if (role === null) throw new AccessError(404, "Not found");
  const rows = await prisma.collaborator.findMany({
    where: { screenplayId: id },
    include: { user: { select: { email: true, name: true } } },
  });
  return rows.map((c) => ({
    id: c.id,
    email: c.user.email,
    name: c.user.name,
    role: c.role as Role,
  }));
}

/** Invite an existing user by email with a role (OWNER only). */
export async function addCollaborator(
  id: string,
  userId: string,
  email: string,
  role: Exclude<Role, "OWNER">,
): Promise<CollaboratorInfo> {
  const actorRole = await resolveRole(id, userId);
  if (actorRole === null) throw new AccessError(404, "Not found");
  if (actorRole !== "OWNER") throw new AccessError(403, "Only the owner can share");

  const invitee = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!invitee) {
    throw new AccessError(404, "No user with that email yet — ask them to sign in once first.");
  }
  const c = await prisma.collaborator.upsert({
    where: { screenplayId_userId: { screenplayId: id, userId: invitee.id } },
    update: { role },
    create: { screenplayId: id, userId: invitee.id, role },
    include: { user: { select: { email: true, name: true } } },
  });
  return { id: c.id, email: c.user.email, name: c.user.name, role: c.role as Role };
}

/** Remove a collaborator (OWNER only). */
export async function removeCollaborator(
  id: string,
  userId: string,
  collaboratorId: string,
): Promise<void> {
  const actorRole = await resolveRole(id, userId);
  if (actorRole === null) throw new AccessError(404, "Not found");
  if (actorRole !== "OWNER") throw new AccessError(403, "Only the owner can manage sharing");
  await prisma.collaborator.delete({ where: { id: collaboratorId } });
}
