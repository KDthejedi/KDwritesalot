"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addComment,
  deleteComment,
  listComments,
  setCommentResolved,
} from "@/lib/store/remote";
import type { CommentInfo } from "@/lib/store/types";

interface ActiveElement {
  id: string;
  quote: string;
}

interface Props {
  screenplayId: string;
  canComment: boolean;
  currentUserId?: string;
  activeElement: ActiveElement | null;
}

export default function CommentsPanel({
  screenplayId,
  canComment,
  currentUserId,
  activeElement,
}: Props) {
  const [comments, setComments] = useState<CommentInfo[]>([]);
  const [body, setBody] = useState("");
  const [attach, setAttach] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setComments(await listComments(screenplayId));
    } catch {
      /* transient */
    }
  }, [screenplayId]);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    const anchor =
      attach && activeElement
        ? { elementId: activeElement.id, quote: activeElement.quote }
        : null;
    await addComment(screenplayId, body.trim(), anchor);
    setBody("");
    refresh();
  };

  const submitReply = async (threadId: string) => {
    if (!replyBody.trim()) return;
    await addComment(screenplayId, replyBody.trim(), null, threadId);
    setReplyBody("");
    setReplyTo(null);
    refresh();
  };

  const toggleResolved = async (c: CommentInfo) => {
    await setCommentResolved(screenplayId, c.id, !c.resolved);
    refresh();
  };

  const remove = async (c: CommentInfo) => {
    await deleteComment(screenplayId, c.id);
    refresh();
  };

  const topLevel = comments.filter((c) => !c.threadId);
  const repliesOf = (id: string) => comments.filter((c) => c.threadId === id);
  const visible = topLevel.filter((c) => showResolved || !c.resolved);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Comments</h2>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          Show resolved
        </label>
      </div>

      {canComment && (
        <form onSubmit={submit} className="mb-3 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            rows={2}
            aria-label="New comment"
            className="w-full resize-none rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={attach}
                onChange={(e) => setAttach(e.target.checked)}
                disabled={!activeElement}
              />
              {activeElement ? "Attach to current line" : "No line selected"}
            </label>
            <button className="rounded bg-neutral-900 px-3 py-1 text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900">
              Comment
            </button>
          </div>
        </form>
      )}

      <ul className="space-y-3">
        {visible.length === 0 && <li className="text-xs text-neutral-400">No comments yet.</li>}
        {visible.map((c) => (
          <li key={c.id} className={`rounded border p-2 ${c.resolved ? "opacity-60" : ""} border-neutral-200 dark:border-neutral-800`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{c.authorName ?? "Someone"}</span>
              <span className="text-[10px] text-neutral-400">
                {new Date(c.createdAt).toLocaleString()}
              </span>
            </div>
            {c.anchor?.quote && (
              <div className="my-1 border-l-2 border-neutral-300 pl-2 text-[11px] italic text-neutral-500">
                {c.anchor.quote}
              </div>
            )}
            <p className="whitespace-pre-wrap">{c.body}</p>

            {repliesOf(c.id).map((r) => (
              <div key={r.id} className="mt-2 border-l-2 border-neutral-200 pl-2 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{r.authorName ?? "Someone"}</span>
                  {(r.authorId === currentUserId) && (
                    <button onClick={() => remove(r)} className="text-[10px] text-red-500 hover:underline">
                      delete
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-[13px]">{r.body}</p>
              </div>
            ))}

            {canComment && (
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <button onClick={() => toggleResolved(c)} className="text-neutral-500 hover:underline">
                  {c.resolved ? "Reopen" : "Resolve"}
                </button>
                <button
                  onClick={() => setReplyTo((cur) => (cur === c.id ? null : c.id))}
                  className="text-neutral-500 hover:underline"
                >
                  Reply
                </button>
                {c.authorId === currentUserId && (
                  <button onClick={() => remove(c)} className="text-red-500 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            )}

            {replyTo === c.id && (
              <div className="mt-2 flex gap-1">
                <input
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Reply…"
                  aria-label="Reply"
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                />
                <button
                  onClick={() => submitReply(c.id)}
                  className="rounded bg-neutral-900 px-2 py-1 text-xs text-white dark:bg-white dark:text-neutral-900"
                >
                  Send
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
