"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type { ElementType, Screenplay } from "@/lib/screenplay/types";
import {
  ELEMENT_LABELS,
  collectCharacterNames,
  cycleType,
  formatText,
  nextTypeOnEnter,
  suggestCompletions,
} from "@/lib/screenplay/behaviors";
import { ELEMENT_STYLE } from "./elementStyles";
import {
  appendElement,
  elementsArray,
  insertElement,
  readElements,
  readScreenplay,
  setElementField,
  setElementText,
  type ReadElement,
} from "@/lib/collab/ydoc";

interface RemoteUser {
  name: string;
  color: string;
  focusId?: string;
}

interface Props {
  doc: Y.Doc;
  provider: HocuspocusProvider | null;
  readOnly?: boolean;
  onDocChange?: (doc: Screenplay) => void;
}

const PALETTE = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % PALETTE.length;
  return PALETTE[h];
}

export default function CollaborativeEditor({ doc, provider, readOnly = false, onDocChange }: Props) {
  const [, forceRender] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteUser[]>([]);

  const refs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const pendingFocus = useRef<{ id: string; caret: number } | null>(null);

  // Re-render + propagate canonical doc whenever the shared document changes.
  useEffect(() => {
    const rerender = () => {
      forceRender((n) => n + 1);
      onDocChange?.(readScreenplay(doc));
    };
    const arr = elementsArray(doc);
    arr.observeDeep(rerender);
    doc.getMap("titlePage").observe(rerender);
    // Emit once initially.
    onDocChange?.(readScreenplay(doc));
    return () => {
      arr.unobserveDeep(rerender);
      doc.getMap("titlePage").unobserve(rerender);
    };
  }, [doc, onDocChange]);

  // Presence: publish our focus, subscribe to others'.
  useEffect(() => {
    if (!provider) return;
    const awareness = provider.awareness;
    if (!awareness) return;
    const update = () => {
      const states = Array.from(awareness.getStates().entries());
      const self = awareness.clientID;
      const others: RemoteUser[] = [];
      for (const [clientId, state] of states) {
        if (clientId === self) continue;
        const u = (state as { user?: { name?: string }; focusId?: string }).user;
        if (u?.name) {
          others.push({
            name: u.name,
            color: colorFor(u.name),
            focusId: (state as { focusId?: string }).focusId,
          });
        }
      }
      setRemote(others);
    };
    awareness.on("change", update);
    update();
    return () => awareness.off("change", update);
  }, [provider]);

  const setFocusPresence = useCallback(
    (id: string | null) => {
      provider?.awareness?.setLocalStateField("focusId", id);
    },
    [provider],
  );

  // Restore caret after a re-render driven by document changes.
  useLayoutEffect(() => {
    const req = pendingFocus.current;
    if (!req) return;
    const node = refs.current.get(req.id);
    if (node) {
      node.focus();
      const pos = Math.min(req.caret, node.value.length);
      node.setSelectionRange(pos, pos);
    }
    pendingFocus.current = null;
  });

  const elements = readElements(doc);
  const characters = collectCharacterNames(elements);

  const onTextChange = useCallback(
    (index: number, el: ReadElement, raw: string, caret: number) => {
      if (readOnly) return;
      const formatted = formatText(el.type, raw);
      setElementText(doc, index, formatted);
      pendingFocus.current = { id: el.id, caret: formatted === raw ? caret : formatted.length };
    },
    [doc, readOnly],
  );

  const changeType = useCallback(
    (index: number, el: ReadElement, type: ElementType) => {
      if (readOnly) return;
      doc.transact(() => {
        setElementField(doc, index, "type", type);
        setElementText(doc, index, formatText(type, el.text));
      });
      pendingFocus.current = { id: el.id, caret: refs.current.get(el.id)?.selectionStart ?? 0 };
    },
    [doc, readOnly],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, el: ReadElement, index: number) => {
      if (readOnly) return;
      const ta = e.currentTarget;

      if (e.key === "Tab") {
        e.preventDefault();
        changeType(index, el, cycleType(el.type, e.shiftKey ? -1 : 1));
        return;
      }
      if (e.key === "Enter" && e.shiftKey) return; // soft break
      if (e.key === "Enter") {
        e.preventDefault();
        const caret = ta.selectionStart;
        const before = el.text.slice(0, caret);
        const after = el.text.slice(caret);
        const newType = nextTypeOnEnter(el.type);
        const arr = elementsArray(doc);
        const newId = `y-split-${Date.now().toString(36)}-${index}`;
        doc.transact(() => {
          setElementText(doc, index, formatText(el.type, before));
          insertElement(arr, index + 1, { type: newType, text: formatText(newType, after), id: newId });
        });
        pendingFocus.current = { id: newId, caret: 0 };
        return;
      }
      if (e.key === "Backspace" && ta.selectionStart === 0 && ta.selectionEnd === 0 && index > 0) {
        e.preventDefault();
        const arr = elementsArray(doc);
        const prev = elements[index - 1];
        const mergeCaret = prev.text.length;
        doc.transact(() => {
          setElementText(doc, index - 1, formatText(prev.type, prev.text + el.text));
          arr.delete(index, 1);
        });
        pendingFocus.current = { id: prev.id, caret: mergeCaret };
        return;
      }
    },
    [doc, elements, readOnly, changeType],
  );

  const acceptSuggestion = useCallback(
    (index: number, id: string, value: string) => {
      if (readOnly) return;
      setElementText(doc, index, value);
      pendingFocus.current = { id, caret: value.length };
    },
    [doc, readOnly],
  );

  // Ensure at least one element exists.
  useEffect(() => {
    if (elements.length === 0 && !readOnly) {
      appendElement(elementsArray(doc), { type: "scene_heading", text: "" });
    }
  }, [elements.length, doc, readOnly]);

  return (
    <div>
      {provider && (
        <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500">
          <span
            className={`inline-block h-2 w-2 rounded-full ${provider.synced ? "bg-green-500" : "bg-neutral-400"}`}
          />
          {remote.length === 0 ? (
            <span>No one else here right now.</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              Editing with:
              {remote.map((u, i) => (
                <span key={i} className="rounded px-1.5" style={{ backgroundColor: u.color, color: "white" }}>
                  {u.name}
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      <div className="screenplay-page mx-auto max-w-[8.5in] rounded bg-white p-[1in] text-black shadow-sm">
        <div className="ml-[1.5in]">
          {elements.map((el, index) => {
            const isActive = activeId === el.id;
            const remoteEditor = remote.find((u) => u.focusId === el.id);
            const suggestions = isActive
              ? suggestCompletions(el.type, el.text, { characters, locations: [] }).slice(0, 5)
              : [];
            return (
              <div
                key={el.id}
                className="group relative"
                style={remoteEditor ? { boxShadow: `inset 3px 0 0 ${remoteEditor.color}` } : undefined}
              >
                <button
                  type="button"
                  onClick={() => changeType(index, el, cycleType(el.type))}
                  className="absolute -left-[1.55in] top-0 hidden w-[1.4in] select-none text-right text-[9px] uppercase tracking-wide text-neutral-400 group-focus-within:block group-hover:block"
                  tabIndex={-1}
                  title="Click to change element type (or press Tab)"
                >
                  {ELEMENT_LABELS[el.type]}
                </button>
                <textarea
                  ref={(node) => {
                    if (node) refs.current.set(el.id, node);
                    else refs.current.delete(el.id);
                  }}
                  value={el.text}
                  onChange={(e) => onTextChange(index, el, e.target.value, e.target.selectionStart)}
                  onKeyDown={(e) => handleKeyDown(e, el, index)}
                  onFocus={() => {
                    setActiveId(el.id);
                    setFocusPresence(el.id);
                  }}
                  onBlur={() => {
                    setActiveId((cur) => (cur === el.id ? null : cur));
                    setFocusPresence(null);
                  }}
                  readOnly={readOnly}
                  rows={1}
                  spellCheck={el.type === "action" || el.type === "dialogue"}
                  className="my-0 block resize-none overflow-hidden border-0 bg-transparent p-0 leading-[1] outline-none focus:bg-yellow-50"
                  style={{ ...ELEMENT_STYLE[el.type], fontFamily: "inherit", fontSize: "inherit" }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = "auto";
                    t.style.height = `${t.scrollHeight}px`;
                  }}
                />
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-w-[40ch] rounded border border-neutral-200 bg-white text-[11px] shadow">
                    {suggestions.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          className="block w-full px-2 py-1 text-left hover:bg-neutral-100"
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            acceptSuggestion(index, el.id, s);
                          }}
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
