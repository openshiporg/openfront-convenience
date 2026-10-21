import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import {
  EvidenceTable,
  PlatformPage,
} from "../components/PlatformPage";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const workflows = [
  [
    "POS & cash",
    "Open shifts and registers, post cash movements.",
    "/dashboard/platform/pos",
  ],
  [
    "Fuel control",
    "Price changes, tank readings and wet-stock checks.",
    "/dashboard/platform/fuel",
  ],
  [
    "Inventory",
    "Adjust stock and advance controlled counts.",
    "/dashboard/platform/inventory",
  ],
  [
    "Purchasing",
    "Approve orders and inspect posted receipts.",
    "/dashboard/platform/purchasing",
  ],
  [
    "Reconciliation",
    "Generate and lock store-day settlement.",
    "/dashboard/platform/reconciliation",
  ],
  [
    "Exceptions",
    "Review open exceptions.",
    "/dashboard/platform/exceptions",
  ],
] as const;

export async function OverviewPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("overview", searchParams);
  return (
    <PlatformPage
      title="Overview"
      description="Today's sales, close status and open issues."
      {...state}
    >
      {state.projection ? (
        <>
          <section aria-labelledby="workflow-heading" className="space-y-3">
            <div>
              <h2 id="workflow-heading" className="text-lg font-semibold">
                Continue a workflow
              </h2>
            </div>
            <div className="grid gap-px border bg-border sm:grid-cols-2 xl:grid-cols-3">
              {workflows.map(([title, , href]) => (
                <Link
                  key={href}
                  href={href}
                  className="group min-w-0 bg-background p-4 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                    {title}
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <EvidenceTable
            rows={state.projection.rows}
            title="Recent store days"
          />
        </>
      ) : null}
    </PlatformPage>
  );
}
