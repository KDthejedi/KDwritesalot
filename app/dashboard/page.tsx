"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createScreenplay,
  deleteScreenplay,
  listScreenplays,
  type ScreenplaySummary,
} from "@/lib/store/local";

export default function Dashboard() {
  const router = useRouter();
  const [items, setItems] = useState<ScreenplaySummary[] | null>(null);

  useEffect(() => {
    setItems(listScreenplays());
  }, []);

  const handleCreate = () => {
    const record = createScreenplay();
    router.push(`/s/${record.id}`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this screenplay? This cannot be undone.")) return;
    deleteScreenplay(id);
    setItems(listScreenplays());
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            KDwritesalot
          </Link>
          <h1 className="text-2xl font-bold">Your screenplays</h1>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          New screenplay
        </button>
      </div>

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
                <span className="ml-3 text-xs text-neutral-400">
                  {new Date(s.updatedAt).toLocaleString()}
                </span>
              </Link>
              <button
                onClick={() => handleDelete(s.id)}
                className="ml-4 text-xs text-red-500 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-neutral-400">
        Screenplays are saved in this browser. Cloud accounts and real-time
        co-writing arrive in a later phase.
      </p>
    </main>
  );
}
