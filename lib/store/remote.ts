/**
 * Remote (API-backed) store. Same surface as lib/store/local.ts but async,
 * talking to the /api/screenplays routes. Used once the user is signed in.
 */

import type { Screenplay } from "@/lib/screenplay/types";
import type { Revision } from "@/lib/provenance";
import type {
  CollaboratorInfo,
  CommentAnchor,
  CommentInfo,
  Role,
  ScreenplaySummary,
  StoredScreenplay,
} from "./types";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

export async function listScreenplays(): Promise<ScreenplaySummary[]> {
  const data = await unwrap<{ items: ScreenplaySummary[] }>(await fetch("/api/screenplays"));
  return data.items;
}

export async function createScreenplay(doc?: Screenplay): Promise<StoredScreenplay> {
  return unwrap<StoredScreenplay>(
    await fetch("/api/screenplays", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(doc ? { doc } : {}),
    }),
  );
}

export async function getScreenplay(id: string): Promise<StoredScreenplay> {
  return unwrap<StoredScreenplay>(await fetch(`/api/screenplays/${id}`));
}

export async function saveDoc(id: string, doc: Screenplay): Promise<void> {
  await unwrap(
    await fetch(`/api/screenplays/${id}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({ doc }),
    }),
  );
}

export async function deleteScreenplay(id: string): Promise<void> {
  await unwrap(await fetch(`/api/screenplays/${id}`, { method: "DELETE" }));
}

export async function saveRevision(
  id: string,
  doc: Screenplay,
  label?: string,
  message?: string,
): Promise<Revision> {
  return unwrap<Revision>(
    await fetch(`/api/screenplays/${id}/revisions`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ doc, label, message }),
    }),
  );
}

export async function listCollaborators(id: string): Promise<CollaboratorInfo[]> {
  const data = await unwrap<{ items: CollaboratorInfo[] }>(
    await fetch(`/api/screenplays/${id}/collaborators`),
  );
  return data.items;
}

export async function addCollaborator(
  id: string,
  email: string,
  role: Role,
): Promise<CollaboratorInfo> {
  return unwrap<CollaboratorInfo>(
    await fetch(`/api/screenplays/${id}/collaborators`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email, role }),
    }),
  );
}

export async function removeCollaborator(id: string, collaboratorId: string): Promise<void> {
  await unwrap(
    await fetch(`/api/screenplays/${id}/collaborators?collaboratorId=${collaboratorId}`, {
      method: "DELETE",
    }),
  );
}

export async function listComments(id: string): Promise<CommentInfo[]> {
  const data = await unwrap<{ items: CommentInfo[] }>(
    await fetch(`/api/screenplays/${id}/comments`),
  );
  return data.items;
}

export async function addComment(
  id: string,
  body: string,
  anchor?: CommentAnchor | null,
  threadId?: string | null,
): Promise<CommentInfo> {
  return unwrap<CommentInfo>(
    await fetch(`/api/screenplays/${id}/comments`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ body, anchor, threadId }),
    }),
  );
}

export async function setCommentResolved(
  id: string,
  commentId: string,
  resolved: boolean,
): Promise<void> {
  await unwrap(
    await fetch(`/api/screenplays/${id}/comments/${commentId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ resolved }),
    }),
  );
}

export async function deleteComment(id: string, commentId: string): Promise<void> {
  await unwrap(
    await fetch(`/api/screenplays/${id}/comments/${commentId}`, { method: "DELETE" }),
  );
}
