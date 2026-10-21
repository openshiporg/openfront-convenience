"use client";

import Link from "next/link";
import { useState } from "react";

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
      className="rounded-xl border bg-card p-4"
      aria-labelledby="receipt-lookup-title"
    >
      <h2 id="receipt-lookup-title" className="font-semibold">
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
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          type="search"
          name="receiptSearch"
          minLength={2}
          maxLength={80}
          autoComplete="off"
          defaultValue={search ?? ""}
          placeholder="Receipt number (at least 2 characters)"
        />
        <button
          className="h-9 rounded-md border px-3 text-sm font-medium hover:bg-muted"
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
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
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
            className="rounded-md bg-primary px-3 py-2 text-center text-sm text-primary-foreground"
            href={`/dashboard/platform/pos/receipt/${encodeURIComponent(selectedSaleId)}?${query}`}
          >
            Open / print receipt
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No matching receipts are available in this store.
        </p>
      )}
    </section>
  );
}
