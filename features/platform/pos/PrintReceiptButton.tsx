"use client";

export function PrintReceiptButton() {
  return <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground print:hidden" onClick={() => window.print()}>Print receipt</button>;
}
