"use client";

import { useState, type ReactNode } from "react";

import { inputClass, labelClass } from "../components/cv-ui";
import type { PlatformOption } from "../lib/projection";
import { PlatformSelect } from "../components/PlatformSelect";

const fieldClass = "h-9 rounded-[4px] text-[13px] max-sm:h-11 max-sm:text-base";

/**
 * Sale, line and original-tender selects for a refund. Lines and tenders are
 * limited to the chosen sale, so a cashier can't pair one sale with another's line.
 */
export function RefundSalePicker({
  sales,
  lines,
  tenders,
  lineSale,
  tenderSale,
  split,
}: {
  sales: PlatformOption[];
  lines: PlatformOption[];
  tenders: PlatformOption[];
  lineSale: PlatformOption[];
  tenderSale: PlatformOption[];
  /** Amount fields for a sale paid two ways; shown folded with the second payment. */
  split?: ReactNode;
}) {
  const [saleId, setSaleId] = useState(sales.length === 1 ? sales[0].id : "");
  const saleOf = (map: PlatformOption[], id: string) => map.find((entry) => entry.id === id)?.label ?? "";
  const saleLines = lines.filter((line) => saleOf(lineSale, line.id) === saleId);
  const saleTenders = tenders.filter((tender) => saleOf(tenderSale, tender.id) === saleId);
  const select = (
    label: string,
    name: string,
    options: PlatformOption[],
    required: boolean,
    empty: string,
  ) => (
    <label className={labelClass}>
      {label}
      <PlatformSelect
        key={`${name}-${saleId}`}
        name={name}
        required={required}
        defaultValue={required && options.length === 1 ? options[0].id : ""}
        placeholder={saleId ? (options.length ? "Select" : empty) : "Choose the sale first"}
        options={options.map((option) => ({ value: option.id, label: option.detail ? `${option.label} · ${option.detail}` : option.label }))}
        className={fieldClass}
      />
    </label>
  );
  return (
    <>
      <label className={labelClass}>
        Sale
        <PlatformSelect
          name="saleId"
          required
          value={saleId}
          onValueChange={setSaleId}
          placeholder={sales.length ? "Select" : "Find the receipt above"}
          options={sales.map((sale) => ({ value: sale.id, label: sale.detail ? `${sale.label} · ${sale.detail}` : sale.label }))}
          className={fieldClass}
        />
      </label>
      {select("Sale line", "saleLineId", saleLines, true, "No refundable lines")}
      {select("Original tender", "originalTenderId", saleTenders, true, "No refundable tender")}
      {/* Most sales are paid one way and the refund goes back that way; two-way sales open this. */}
      <details className="rounded-md border border-dashed px-3 py-1 sm:col-span-2" open={saleTenders.length > 1 || undefined}>
        <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-muted-foreground sm:min-h-9 sm:py-2">Sale was paid two ways (split the refund)</summary>
        <div className="mt-1 mb-3 grid gap-3 sm:grid-cols-2">
          {select("Second payment", "originalTenderId2", saleTenders, false, "No second payment")}
          {split}
        </div>
      </details>
    </>
  );
}
