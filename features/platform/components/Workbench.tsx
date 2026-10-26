"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { Count, pillClass, trackClass } from "./cv-ui";

export type WorkbenchSection = {
  id: string;
  label: string;
  count?: number;
  content: ReactNode;
};

const storageKey = (scope: string) => `ofc-workbench:${scope}`;

/**
 * In-page task switcher: a recessed track of raised pills. Every section stays
 * rendered so half-filled forms survive a switch; the chosen section is kept
 * per page for the session so it reopens after a form posts and redirects.
 */
export function Workbench({
  scope,
  sections,
}: {
  scope: string;
  sections: Array<WorkbenchSection | false | null | undefined>;
}) {
  const visible = sections.filter((section): section is WorkbenchSection => Boolean(section));
  const [active, setActive] = useState(visible[0]?.id ?? "");
  const baseId = useId();

  useEffect(() => {
    const ids = visible.map((section) => section.id);
    const fromHash = window.location.hash.slice(1);
    let stored = "";
    try {
      stored = window.sessionStorage.getItem(storageKey(scope)) ?? "";
    } catch {}
    const next = ids.includes(fromHash) ? fromHash : ids.includes(stored) ? stored : "";
    if (next) setActive(next);
    // Sections are fixed for a page render; only the scope matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const choose = (id: string) => {
    setActive(id);
    try {
      window.sessionStorage.setItem(storageKey(scope), id);
    } catch {}
  };

  if (!visible.length) return null;

  return (
    <div className="min-w-0 space-y-5">
      {/* On phones the pills wrap so no task is hidden past the edge. */}
      <div role="tablist" aria-label="Tasks" className={`${trackClass}`}>
        {visible.map((section) => (
          <button
            key={section.id}
            type="button"
            role="tab"
            id={`${baseId}-${section.id}-tab`}
            aria-controls={`${baseId}-${section.id}`}
            aria-selected={active === section.id}
            data-active={active === section.id}
            onClick={() => choose(section.id)}
            className={pillClass}
          >
            {section.label}
            {section.count !== undefined ? <Count>{section.count}</Count> : null}
          </button>
        ))}
      </div>
      {visible.map((section) => (
        <div
          key={section.id}
          role="tabpanel"
          id={`${baseId}-${section.id}`}
          aria-labelledby={`${baseId}-${section.id}-tab`}
          hidden={active !== section.id}
          className="min-w-0 space-y-4"
        >
          {section.content}
        </div>
      ))}
    </div>
  );
}
