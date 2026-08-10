"use client";

import { useEffect, useState } from "react";
import {
  addCollaborator,
  listCollaborators,
  removeCollaborator,
} from "@/lib/store/remote";
import type { CollaboratorInfo, Role } from "@/lib/store/types";

const ROLES: Exclude<Role, "OWNER">[] = ["EDITOR", "COMMENTER", "VIEWER"];

export default function SharePanel({ screenplayId }: { screenplayId: string }) {
  const [items, setItems] = useState<CollaboratorInfo[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "OWNER">>("EDITOR");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      setItems(await listCollaborators(screenplayId));
    } catch {
      /* ignore transient errors */
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenplayId]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await addCollaborator(screenplayId, email.trim(), role);
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add collaborator");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (collaboratorId: string) => {
    await removeCollaborator(screenplayId, collaboratorId);
    refresh();
  };

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 className="mb-3 font-semibold">Share</h2>
      <form onSubmit={invite} className="space-y-2">
        <input
          type="email"
          required
          placeholder="collaborator@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <div className="flex gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Exclude<Role, "OWNER">)}
            className="flex-1 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0) + r.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            className="rounded bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            Invite
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <ul className="mt-3 space-y-1">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between">
            <span className="truncate">
              {c.name ?? c.email}{" "}
              <span className="text-[10px] uppercase text-neutral-400">{c.role}</span>
            </span>
            <button onClick={() => revoke(c.id)} className="text-xs text-red-500 hover:underline">
              Remove
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-neutral-400">No collaborators yet.</li>
        )}
      </ul>
      <p className="mt-2 text-[10px] leading-snug text-neutral-400">
        Invitees must have signed in at least once so we can find their account.
      </p>
    </section>
  );
}
