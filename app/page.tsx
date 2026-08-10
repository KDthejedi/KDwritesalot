import Link from "next/link";
import Wordmark from "@/components/Wordmark";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <h1 className="tracking-tight">
          <Wordmark size={44} />
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-300">
          A collaborative screenplay studio. Write in proper industry format,
          co-write in real time, export copyright-ready PDF and Final Draft
          files, and keep a timestamped version history that documents your
          authorship.
        </p>
      </div>

      <ul className="grid gap-3 text-sm text-neutral-700 dark:text-neutral-300 sm:grid-cols-2">
        <li className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <strong className="block text-base text-neutral-900 dark:text-neutral-100">
            Industry formatting
          </strong>
          Scene headings, action, dialogue, and transitions with Final
          Draft-style Tab/Enter cycling.
        </li>
        <li className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <strong className="block text-base text-neutral-900 dark:text-neutral-100">
            Copyright-ready export
          </strong>
          One-click PDF and <code>.fdx</code> with a title page from your
          project metadata.
        </li>
        <li className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <strong className="block text-base text-neutral-900 dark:text-neutral-100">
            Version history
          </strong>
          Every save is timestamped and hashed, building an authorship trail.
        </li>
        <li className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <strong className="block text-base text-neutral-900 dark:text-neutral-100">
            Real-time co-writing
          </strong>
          Write together with live cursors and presence.
        </li>
      </ul>

      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Go to your screenplays
        </Link>
      </div>
    </main>
  );
}
