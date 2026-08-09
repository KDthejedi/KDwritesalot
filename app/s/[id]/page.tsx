"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ScreenplayEditor from "@/components/editor/ScreenplayEditor";
import type { Screenplay, TitlePage } from "@/lib/screenplay/types";
import { serialize } from "@/lib/screenplay/fountain";
import { safeFilename } from "@/lib/export/filename";
import {
  buildProvenanceRecord,
  createRevision,
  verifyChain,
  type Revision,
} from "@/lib/provenance";
import {
  getScreenplay,
  newId,
  saveScreenplay,
  type StoredScreenplay,
} from "@/lib/store/local";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [record, setRecord] = useState<StoredScreenplay | null | undefined>(undefined);
  const [titlePage, setTitlePage] = useState<TitlePage>({});
  const [showMeta, setShowMeta] = useState(false);
  const [status, setStatus] = useState("");

  const docRef = useRef<Screenplay>({ titlePage: {}, elements: [] });
  const revisionsRef = useRef<Revision[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the screenplay once on mount.
  useEffect(() => {
    const rec = getScreenplay(id);
    setRecord(rec);
    if (rec) {
      setTitlePage(rec.doc.titlePage ?? {});
      docRef.current = rec.doc;
      revisionsRef.current = rec.revisions ?? [];
    }
  }, [id]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const rec = getScreenplay(id);
      const base: StoredScreenplay =
        rec ??
        ({
          id,
          title: "Untitled Screenplay",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          doc: docRef.current,
          revisions: [],
        } as StoredScreenplay);
      base.doc = docRef.current;
      base.revisions = revisionsRef.current;
      saveScreenplay(base);
      setStatus(`Saved ${new Date().toLocaleTimeString()}`);
    }, 600);
  }, [id]);

  const handleEditorChange = useCallback(
    (doc: Screenplay) => {
      docRef.current = doc;
      scheduleSave();
    },
    [scheduleSave],
  );

  const updateMeta = (key: keyof TitlePage, value: string) => {
    setTitlePage((prev) => {
      const next = { ...prev, [key]: value };
      docRef.current = { ...docRef.current, titlePage: next };
      scheduleSave();
      return next;
    });
  };

  const saveVersion = () => {
    const label = window.prompt("Name this version (optional):", "") ?? "";
    const message = window.prompt("Describe the change (optional):", "") ?? "";
    const prev = revisionsRef.current[revisionsRef.current.length - 1] ?? null;
    const rev = createRevision(
      docRef.current,
      {
        id: newId(),
        screenplayId: id,
        authorId: "local",
        authorName: "You",
        createdAt: new Date().toISOString(),
        label: label.trim() || undefined,
        message: message.trim() || undefined,
      },
      prev,
    );
    revisionsRef.current = [...revisionsRef.current, rev];
    scheduleSave();
    setStatus(`Version saved (${rev.contentHash.slice(0, 10)}…)`);
    // Force a re-render to show the new revision.
    setRecord((r) => (r ? { ...r, revisions: revisionsRef.current } : r));
  };

  const exportServer = async (kind: "pdf" | "fdx") => {
    setStatus(`Exporting ${kind.toUpperCase()}…`);
    const res = await fetch(`/api/export/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(docRef.current),
    });
    if (!res.ok) {
      setStatus(`Export failed (${res.status})`);
      return;
    }
    const blob = await res.blob();
    triggerDownload(blob, safeFilename(titlePage.title ?? "screenplay", kind));
    setStatus(`${kind.toUpperCase()} exported`);
  };

  const exportFountain = () => {
    const text = serialize(docRef.current);
    triggerDownload(new Blob([text], { type: "text/plain" }), safeFilename(titlePage.title ?? "screenplay", "fountain"));
  };

  const exportProvenance = () => {
    const record = buildProvenanceRecord(
      {
        screenplayId: id,
        title: titlePage.title ?? "Untitled Screenplay",
        author: titlePage.author,
        generatedAt: new Date().toISOString(),
      },
      revisionsRef.current,
    );
    triggerDownload(
      new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }),
      safeFilename(titlePage.title ?? "screenplay", "provenance.json"),
    );
  };

  if (record === undefined) {
    return <main className="p-12 text-neutral-500">Loading…</main>;
  }
  if (record === null) {
    return (
      <main className="p-12">
        <p className="mb-4">Screenplay not found in this browser.</p>
        <Link href="/dashboard" className="underline">
          Back to your screenplays
        </Link>
      </main>
    );
  }

  const revisions = revisionsRef.current;
  const chainOk = verifyChain(revisions);

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* Toolbar */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
        <Link href="/dashboard" className="text-neutral-500 hover:underline">
          ← All
        </Link>
        <input
          value={titlePage.title ?? ""}
          onChange={(e) => updateMeta("title", e.target.value)}
          placeholder="Untitled Screenplay"
          className="min-w-40 flex-1 rounded border border-transparent bg-transparent px-2 py-1 font-medium hover:border-neutral-300 focus:border-neutral-400 focus:outline-none"
        />
        <button onClick={() => setShowMeta((v) => !v)} className="rounded border px-2 py-1">
          Title page
        </button>
        <button onClick={saveVersion} className="rounded border px-2 py-1">
          Save version
        </button>
        <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
        <button onClick={() => exportServer("pdf")} className="rounded border px-2 py-1">
          PDF
        </button>
        <button onClick={() => exportServer("fdx")} className="rounded border px-2 py-1">
          Final Draft
        </button>
        <button onClick={exportFountain} className="rounded border px-2 py-1">
          Fountain
        </button>
        <span className="ml-auto text-xs text-neutral-400">{status}</span>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Editor */}
        <div className="min-w-0 flex-1">
          <ScreenplayEditor
            initialDoc={record.doc}
            titlePage={titlePage}
            onChange={handleEditorChange}
          />
        </div>

        {/* Side panel */}
        <aside className="hidden w-72 shrink-0 space-y-6 lg:block">
          {showMeta && (
            <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="mb-3 font-semibold">Title page</h2>
              {(
                [
                  ["author", "Author"],
                  ["credit", "Credit (e.g. Written by)"],
                  ["source", "Source"],
                  ["draftDate", "Draft date"],
                  ["contact", "Contact"],
                  ["copyright", "Copyright notice"],
                ] as [keyof TitlePage, string][]
              ).map(([key, label]) => (
                <label key={key} className="mb-2 block">
                  <span className="text-xs text-neutral-500">{label}</span>
                  <input
                    value={(titlePage[key] as string) ?? ""}
                    onChange={(e) => updateMeta(key, e.target.value)}
                    className="mt-1 w-full rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </label>
              ))}
            </section>
          )}

          <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Version history</h2>
              {revisions.length > 0 && (
                <span className={chainOk ? "text-xs text-green-600" : "text-xs text-red-600"}>
                  {chainOk ? "chain ✓" : "chain ✗"}
                </span>
              )}
            </div>
            {revisions.length === 0 ? (
              <p className="text-xs text-neutral-400">
                No versions yet. Click “Save version” to record a timestamped,
                hashed snapshot for your authorship trail.
              </p>
            ) : (
              <ol className="space-y-2">
                {[...revisions].reverse().map((r) => (
                  <li key={r.id} className="border-b border-neutral-100 pb-2 dark:border-neutral-800">
                    <div className="font-medium">{r.label ?? "(unnamed)"}</div>
                    <div className="text-xs text-neutral-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.message && <div className="text-xs text-neutral-500">{r.message}</div>}
                    <code className="text-[10px] text-neutral-400">{r.contentHash.slice(0, 16)}…</code>
                  </li>
                ))}
              </ol>
            )}
            {revisions.length > 0 && (
              <button onClick={exportProvenance} className="mt-3 w-full rounded border px-2 py-1 text-xs">
                Export provenance record (JSON)
              </button>
            )}
            <p className="mt-3 text-[10px] leading-snug text-neutral-400">
              Supporting evidence of authorship, not a legal registration. File
              with the U.S. Copyright Office / WGA to register.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
