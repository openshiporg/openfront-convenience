"use client";

import { useState } from "react";

import { inputClass, labelClass } from "../components/cv-ui";
import type { PlatformOption } from "../lib/projection";

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
      <select key={`${name}-${saleId}`} name={name} required={required} className={inputClass} defaultValue={required && options.length === 1 ? options[0].id : ""}>
        <option value="">{saleId ? (options.length ? "Select" : empty) : "Choose the sale first"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
            {option.detail ? ` · ${option.detail}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <label className={labelClass}>
        Sale
        <select name="saleId" required value={saleId} onChange={(event) => setSaleId(event.target.value)} className={inputClass}>
          <option value="">{sales.length ? "Select" : "Find the receipt above"}</option>
          {sales.map((sale) => (
            <option key={sale.id} value={sale.id}>
              {sale.label}
              {sale.detail ? ` · ${sale.detail}` : ""}
            </option>
          ))}
        </select>
      </label>
      {select("Sale line", "saleLineId", saleLines, true, "No refundable lines")}
      {select("Original tender", "originalTenderId", saleTenders, true, "No refundable tender")}
      {select("Second original tender (optional)", "originalTenderId2", saleTenders, false, "No second tender")}
    </>
  );
}
