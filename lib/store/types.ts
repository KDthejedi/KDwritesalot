/**
 * Shared shapes for both the local (browser) store and the remote (API) store,
 * so the UI is identical regardless of where screenplays are persisted.
 */

import type { Screenplay } from "@/lib/screenplay/types";
import type { Revision } from "@/lib/provenance";

/** Collaborator role (string union; mirrors the Prisma `Role` enum). */
export type Role = "OWNER" | "EDITOR" | "COMMENTER" | "VIEWER";

export interface StoredScreenplay {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  doc: Screenplay;
  revisions: Revision[];
  /** The current viewer's role (remote store only). */
  role?: Role;
}

export interface ScreenplaySummary {
  id: string;
  title: string;
  updatedAt: string;
  /** The current viewer's role (remote store only). */
  role?: Role;
}

/** A collaborator on a screenplay (as returned by the API). */
export interface CollaboratorInfo {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
}

/** Write permission for a role. */
export function canEdit(role: Role | undefined): boolean {
  return role === "OWNER" || role === "EDITOR";
}
