"use client";

import { primaryButtonClass } from "../components/cv-ui";

export function PrintReceiptButton() {
  return <button type="button" className={`${primaryButtonClass} print:hidden`} onClick={() => window.print()}>Print receipt</button>;
}
