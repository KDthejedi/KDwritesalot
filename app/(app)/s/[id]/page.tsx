"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { useSession } from "next-auth/react";
import CollaborativeEditor from "@/components/editor/CollaborativeEditor";
import SharePanel from "@/components/editor/SharePanel";
import CommentsPanel from "@/components/editor/CommentsPanel";
import type { Screenplay, TitlePage } from "@/lib/screenplay/types";
import { serialize } from "@/lib/screenplay/fountain";
import { safeFilename } from "@/lib/export/filename";
import { buildProvenanceRecord, verifyChain, type Revision } from "@/lib/provenance";
import { getScreenplay, saveDoc, saveRevision } from "@/lib/store/remote";
import { canComment, canEdit, type Role } from "@/lib/store/types";
import { initFromScreenplay, setTitleField } from "@/lib/collab/ydoc";

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

  const { data: session } = useSession();
  const doc = useMemo(() => new Y.Doc(), []);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [activeElement, setActiveElement] = useState<{ id: string; quote: string } | null>(null);

  const [loadState, setLoadState] = useState<"loading" | "ok" | "notfound">("loading");
  const [ready, setReady] = useState(false);
  const [titlePage, setTitlePage] = useState<TitlePage>({});
  const [role, setRole] = useState<Role>("VIEWER");
  const [showMeta, setShowMeta] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [status, setStatus] = useState("");
  const [revisionsView, setRevisionsView] = useState<Revision[]>([]);

  const docRef = useRef<Screenplay>({ titlePage: {}, elements: [] });
  const revisionsRef = useRef<Revision[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editable = canEdit(role);

  // Load metadata + revisions, then connect the collaboration provider.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let rec;
      try {
        rec = await getScreenplay(id);
      } catch {
        if (!cancelled) setLoadState("notfound");
        return;
      }
      if (cancelled) return;
      setTitlePage(rec.doc.titlePage ?? {});
      setRole(rec.role ?? "VIEWER");
      revisionsRef.current = rec.revisions ?? [];
      setRevisionsView(rec.revisions ?? []);
      docRef.current = rec.doc;
      setLoadState("ok");

      // Fetch a collaboration token and connect.
      let token = "";
      let url = "ws://localhost:1234";
      try {
        const res = await fetch("/api/collab-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ screenplayId: id }),
        });
        if (res.ok) {
          const data = await res.json();
          token = data.token;
          url = data.url;
        }
      } catch {
        /* fall through to offline mode */
      }

      const finishInit = () => {
        if (cancelled || ready) return;
        initFromScreenplay(doc, rec.doc);
        setReady(true);
      };

      if (token) {
        const p = new HocuspocusProvider({
          url,
          name: id,
          token,
          document: doc,
          onSynced: finishInit,
        });
        providerRef.current = p;
        setProvider(p);
        // Fallback if the collab server can't be reached.
        setTimeout(finishInit, 5000);
      } else {
        finishInit();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Clean up the provider on unmount.
  useEffect(() => {
    return () => {
      providerRef.current?.destroy();
      doc.destroy();
    };
  }, [doc]);

  const scheduleSave = useCallback(() => {
    if (!editable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveDoc(id, docRef.current);
        setStatus(`Saved ${new Date().toLocaleTimeString()}`);
      } catch (e) {
        setStatus(e instanceof Error ? `Save failed: ${e.message}` : "Save failed");
      }
    }, 900);
  }, [id, editable]);

  const handleDocChange = useCallback(
    (next: Screenplay) => {
      docRef.current = next;
      scheduleSave();
    },
    [scheduleSave],
  );

  const updateMeta = (key: keyof TitlePage, value: string) => {
    if (!editable) return;
    setTitlePage((prev) => ({ ...prev, [key]: value }));
    setTitleField(doc, key, value); // syncs to collaborators + triggers save via onDocChange
  };

  const saveVersion = async () => {
    const label = window.prompt("Name this version (optional):", "") ?? "";
    const message = window.prompt("Describe the change (optional):", "") ?? "";
    try {
      const rev = await saveRevision(id, docRef.current, label.trim() || undefined, message.trim() || undefined);
      revisionsRef.current = [...revisionsRef.current, rev];
      setRevisionsView(revisionsRef.current);
      setStatus(`Version saved (${rev.contentHash.slice(0, 10)}…)`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save version");
    }
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
    triggerDownload(await res.blob(), safeFilename(titlePage.title ?? "screenplay", kind));
    setStatus(`${kind.toUpperCase()} exported`);
  };

  const exportFountain = () => {
    triggerDownload(
      new Blob([serialize(docRef.current)], { type: "text/plain" }),
      safeFilename(titlePage.title ?? "screenplay", "fountain"),
    );
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

  if (loadState === "loading") {
    return <main className="p-12 text-neutral-500">Loading…</main>;
  }
  if (loadState === "notfound") {
    return (
      <main className="p-12">
        <p className="mb-4">Screenplay not found, or you don&apos;t have access.</p>
        <Link href="/dashboard" className="underline">
          Back to your screenplays
        </Link>
      </main>
    );
  }

  const chainOk = verifyChain(revisionsView);

  return (
    <div className="bg-neutral-100 dark:bg-neutral-900">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950">
        <Link href="/dashboard" className="text-neutral-500 hover:underline">
          ← All
        </Link>
        <input
          value={titlePage.title ?? ""}
          onChange={(e) => updateMeta("title", e.target.value)}
          placeholder="Untitled Screenplay"
          readOnly={!editable}
          aria-label="Screenplay title"
          className="min-w-40 flex-1 rounded border border-transparent bg-transparent px-2 py-1 font-medium hover:border-neutral-300 focus:border-neutral-400 focus:outline-none"
        />
        {!editable && (
          <span className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {role} · read-only
          </span>
        )}
        {editable && (
          <>
            <button onClick={() => setShowMeta((v) => !v)} className="rounded border px-2 py-1">
              Title page
            </button>
            <button onClick={saveVersion} className="rounded border px-2 py-1">
              Save version
            </button>
          </>
        )}
        {role === "OWNER" && (
          <button onClick={() => setShowShare((v) => !v)} className="rounded border px-2 py-1">
            Share
          </button>
        )}
        <button
          onClick={() => setShowComments((v) => !v)}
          className="rounded border px-2 py-1"
          aria-pressed={showComments}
        >
          Comments
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
        <div className="min-w-0 flex-1">
          {ready ? (
            <CollaborativeEditor
              doc={doc}
              provider={provider}
              readOnly={!editable}
              onDocChange={handleDocChange}
              onActiveElementChange={setActiveElement}
            />
          ) : (
            <p className="text-neutral-500">Connecting to the live document…</p>
          )}
        </div>

        <aside className="hidden w-72 shrink-0 space-y-6 lg:block">
          {showShare && role === "OWNER" && <SharePanel screenplayId={id} />}

          {showComments && (
            <CommentsPanel
              screenplayId={id}
              canComment={canComment(role)}
              currentUserId={session?.user?.id}
              activeElement={activeElement}
            />
          )}

          {showMeta && editable && (
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
              {revisionsView.length > 0 && (
                <span className={chainOk ? "text-xs text-green-600" : "text-xs text-red-600"}>
                  {chainOk ? "chain ✓" : "chain ✗"}
                </span>
              )}
            </div>
            {revisionsView.length === 0 ? (
              <p className="text-xs text-neutral-400">
                No versions yet.{" "}
                {editable ? "Click “Save version” to record a timestamped, hashed snapshot." : ""}
              </p>
            ) : (
              <ol className="space-y-2">
                {[...revisionsView].reverse().map((r) => (
                  <li key={r.id} className="border-b border-neutral-100 pb-2 dark:border-neutral-800">
                    <div className="font-medium">{r.label ?? "(unnamed)"}</div>
                    <div className="text-xs text-neutral-500">
                      {new Date(r.createdAt).toLocaleString()}
                      {r.authorName ? ` · ${r.authorName}` : ""}
                    </div>
                    {r.message && <div className="text-xs text-neutral-500">{r.message}</div>}
                    <code className="text-[10px] text-neutral-400">{r.contentHash.slice(0, 16)}…</code>
                  </li>
                ))}
              </ol>
            )}
            {revisionsView.length > 0 && (
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
