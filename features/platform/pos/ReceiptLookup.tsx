"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass, inputClass, panelClass, primaryButtonClass } from "../components/cv-ui";

type Option = { id: string; label: string; detail?: string | null };

export function ReceiptLookup({
  businessId,
  storeId,
  sales,
  search,
}: {
  businessId: string;
  storeId: string;
  sales: Option[];
  search: string | null;
}) {
  const [saleId, setSaleId] = useState(sales[0]?.id ?? "");
  const selectedSaleId = sales.some((sale) => sale.id === saleId)
    ? saleId
    : (sales[0]?.id ?? "");
  const query = new URLSearchParams({ businessId, storeId }).toString();

  return (
    <section
      className={panelClass}
      aria-labelledby="receipt-lookup-title"
    >
      <h2 id="receipt-lookup-title" className="text-[15px] font-semibold tracking-tight">
        Receipt reprint
      </h2>
      <form
        action="/dashboard/platform/pos"
        method="get"
        className="mt-3 flex flex-col gap-2 sm:flex-row"
      >
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="storeId" value={storeId} />
        <label className="sr-only" htmlFor="receipt-search">
          Search receipt number
        </label>
        <input
          id="receipt-search"
          className={`${inputClass} flex-1`}
          type="search"
          name="receiptSearch"
          minLength={2}
          maxLength={80}
          autoComplete="off"
          defaultValue={search ?? ""}
          placeholder="Receipt number"
        />
        <button
          className={buttonClass}
          type="submit"
        >
          Search receipts
        </button>
      </form>
      {sales.length ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="receipt-sale">
            Receipt result
          </label>
          <select
            id="receipt-sale"
            className={`${inputClass} flex-1`}
            value={selectedSaleId}
            onChange={(event) => setSaleId(event.target.value)}
          >
            {sales.map((sale) => (
              <option key={sale.id} value={sale.id}>
                {sale.label} · {sale.detail}
              </option>
            ))}
          </select>
          <Link
            className={primaryButtonClass}
            href={`/dashboard/platform/pos/receipt/${encodeURIComponent(selectedSaleId)}?${query}`}
          >
            Open receipt
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No matching receipts
        </p>
      )}
    </section>
  );
}
