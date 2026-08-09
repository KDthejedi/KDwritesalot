"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType, Screenplay, ScreenplayElement } from "@/lib/screenplay/types";
import {
  ELEMENT_LABELS,
  collectCharacterNames,
  cycleType,
  formatText,
  nextTypeOnEnter,
  suggestCompletions,
} from "@/lib/screenplay/behaviors";
import { ELEMENT_STYLE } from "./elementStyles";

interface EditorElement extends ScreenplayElement {
  id: string;
}

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  return `el-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

function toEditorElements(doc: Screenplay): EditorElement[] {
  if (doc.elements.length === 0) {
    return [{ id: makeId(), type: "scene_heading", text: "" }];
  }
  return doc.elements.map((el) => ({ ...el, id: makeId() }));
}

export function toScreenplay(elements: EditorElement[], titlePage: Screenplay["titlePage"]): Screenplay {
  return {
    titlePage,
    elements: elements.map(({ id: _id, ...rest }) => rest),
  };
}

interface Props {
  initialDoc: Screenplay;
  /** Controlled title-page metadata (owned by the parent page). */
  titlePage: Screenplay["titlePage"];
  onChange?: (doc: Screenplay) => void;
  /** When true, the document is displayed but cannot be edited. */
  readOnly?: boolean;
}

export default function ScreenplayEditor({
  initialDoc,
  titlePage,
  onChange,
  readOnly = false,
}: Props) {
  const [elements, setElements] = useState<EditorElement[]>(() => toEditorElements(initialDoc));
  const [activeId, setActiveId] = useState<string | null>(null);

  const refs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const pendingFocus = useRef<{ id: string; caret: number } | null>(null);

  // Notify parent of changes (for autosave / preview).
  useEffect(() => {
    onChange?.(toScreenplay(elements, titlePage));
  }, [elements, titlePage, onChange]);

  // Apply a queued focus request after render.
  useEffect(() => {
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

  const characters = useMemo(() => collectCharacterNames(elements), [elements]);

  const updateText = useCallback(
    (id: string, text: string) => {
      if (readOnly) return;
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, text: formatText(el.type, text) } : el)),
      );
    },
    [readOnly],
  );

  const setType = useCallback(
    (id: string, type: ElementType) => {
      if (readOnly) return;
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, type, text: formatText(type, el.text) } : el)),
      );
    },
    [readOnly],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, el: EditorElement, index: number) => {
      if (readOnly) return;
      const ta = e.currentTarget;

      // Tab / Shift+Tab: cycle the element's type.
      if (e.key === "Tab") {
        e.preventDefault();
        setType(el.id, cycleType(el.type, e.shiftKey ? -1 : 1));
        pendingFocus.current = { id: el.id, caret: ta.selectionStart };
        return;
      }

      // Shift+Enter: soft line break within the element.
      if (e.key === "Enter" && e.shiftKey) {
        return; // let the textarea insert a newline
      }

      // Enter: split at caret into a new element below.
      if (e.key === "Enter") {
        e.preventDefault();
        const caret = ta.selectionStart;
        const before = el.text.slice(0, caret);
        const after = el.text.slice(caret);
        const newType = nextTypeOnEnter(el.type);
        const newEl: EditorElement = { id: makeId(), type: newType, text: formatText(newType, after) };
        setElements((prev) => {
          const copy = [...prev];
          copy[index] = { ...el, text: formatText(el.type, before) };
          copy.splice(index + 1, 0, newEl);
          return copy;
        });
        pendingFocus.current = { id: newEl.id, caret: 0 };
        return;
      }

      // Backspace at the very start: merge into previous element (or delete if empty).
      if (e.key === "Backspace" && ta.selectionStart === 0 && ta.selectionEnd === 0 && index > 0) {
        e.preventDefault();
        setElements((prev) => {
          const copy = [...prev];
          const prevEl = copy[index - 1];
          const mergeCaret = prevEl.text.length;
          copy[index - 1] = { ...prevEl, text: formatText(prevEl.type, prevEl.text + el.text) };
          copy.splice(index, 1);
          pendingFocus.current = { id: prevEl.id, caret: mergeCaret };
          return copy;
        });
        return;
      }
    },
    [setType, readOnly],
  );

  const acceptSuggestion = useCallback((id: string, value: string) => {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, text: value } : el)));
    pendingFocus.current = { id, caret: value.length };
  }, []);

  return (
    <div className="screenplay-page mx-auto max-w-[8.5in] rounded bg-white p-[1in] text-black shadow-sm">
      <div className="ml-[1.5in]">
        {elements.map((el, index) => {
          const isActive = activeId === el.id;
          const suggestions = isActive
            ? suggestCompletions(el.type, el.text, { characters, locations: [] }).slice(0, 5)
            : [];
          return (
            <div key={el.id} className="group relative">
              <button
                type="button"
                onClick={() => setType(el.id, cycleType(el.type))}
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
                onChange={(e) => updateText(el.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, el, index)}
                onFocus={() => setActiveId(el.id)}
                onBlur={() => setActiveId((cur) => (cur === el.id ? null : cur))}
                readOnly={readOnly}
                rows={1}
                spellCheck={el.type === "action" || el.type === "dialogue"}
                className="my-0 block resize-none overflow-hidden border-0 bg-transparent p-0 leading-[1] outline-none focus:bg-yellow-50"
                style={{ ...ELEMENT_STYLE[el.type], fontFamily: "inherit", fontSize: "inherit" }}
                onInput={(e) => {
                  // Auto-grow height to fit content.
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
                        // onMouseDown (not onClick) so it fires before blur.
                        onMouseDown={(e) => {
                          e.preventDefault();
                          acceptSuggestion(el.id, s);
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
  );
}
