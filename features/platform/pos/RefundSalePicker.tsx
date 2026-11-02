"use client";

import { useState } from "react";

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
}: {
  sales: PlatformOption[];
  lines: PlatformOption[];
  tenders: PlatformOption[];
  lineSale: PlatformOption[];
  tenderSale: PlatformOption[];
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
      {select("Second original tender (optional)", "originalTenderId2", saleTenders, false, "No second tender")}
    </>
  );
}
