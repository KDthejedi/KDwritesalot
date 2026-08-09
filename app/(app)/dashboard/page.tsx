"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createScreenplay,
  deleteScreenplay,
  listScreenplays,
} from "@/lib/store/remote";
import type { ScreenplaySummary } from "@/lib/store/types";
import { listScreenplays as listLocal, getScreenplay as getLocal } from "@/lib/store/local";

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<ScreenplaySummary[] | null>(null);
  const [error, setError] = useState("");
  const [localCount, setLocalCount] = useState(0);
  const [importing, setImporting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await listScreenplays());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    refresh();
    setLocalCount(listLocal().length);
  }, [refresh]);

  const handleCreate = async () => {
    const record = await createScreenplay();
    router.push(`/s/${record.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this screenplay? This cannot be undone.")) return;
    await deleteScreenplay(id);
    refresh();
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      for (const summary of listLocal()) {
        const local = getLocal(summary.id);
        if (local) await createScreenplay(local.doc);
      }
      setLocalCount(0);
      await refresh();
    } finally {
      setImporting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your screenplays</h1>
        <button
          onClick={handleCreate}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          New screenplay
        </button>
      </div>

      {localCount > 0 && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950">
          <span>
            You have {localCount} screenplay{localCount === 1 ? "" : "s"} saved in this browser.
            Import {localCount === 1 ? "it" : "them"} to your account?
          </span>
          <button
            onClick={handleImport}
            disabled={importing}
            className="ml-4 rounded bg-amber-500 px-3 py-1 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {items === null ? (
        <p className="text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <p className="mb-4 text-neutral-500">You haven&apos;t created any screenplays yet.</p>
          <button onClick={handleCreate} className="text-sm font-medium underline">
            Create your first one
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/s/${s.id}`} className="flex-1">
                <span className="font-medium">{s.title}</span>
                {s.role && s.role !== "OWNER" && (
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500 dark:bg-neutral-800">
                    {s.role}
                  </span>
                )}
                <span className="ml-3 text-xs text-neutral-400">
                  {new Date(s.updatedAt).toLocaleString()}
                </span>
              </Link>
              {s.role === "OWNER" && (
                <button
                  onClick={() => handleDelete(s.id)}
                  className="ml-4 text-xs text-red-500 hover:underline"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
