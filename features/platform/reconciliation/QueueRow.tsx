"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { buttonClass } from "../components/cv-ui";

/**
 * A queue table row whose disposition form opens inline in a full-width row
 * beneath it. The form stays mounted while closed so a half-filled entry survives.
 */
export function QueueRow({
  cells,
  colSpan,
  actionLabel,
  tone,
  children,
}: {
  cells: ReactNode;
  colSpan: number;
  actionLabel: string;
  tone?: "danger" | "warn" | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <tr
        className={`border-b transition-colors hover:bg-muted/40 ${tone === "danger" ? "bg-red-500/[0.04]" : ""} ${open ? "border-b-0 bg-muted/30" : ""}`}
      >
        {cells}
        <td className="h-9 px-3 py-1.5 text-right align-middle last:pr-4">
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((value) => !value)}
            className={`${buttonClass} min-h-8 px-2.5`}
          >
            {actionLabel}
            <ChevronDown aria-hidden="true" className={`size-3.5 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </td>
      </tr>
      <tr id={id} hidden={!open} className="border-b bg-muted/30">
        <td colSpan={colSpan} className="px-4 pb-4 pt-1">
          {children}
        </td>
      </tr>
    </>
  );
}
