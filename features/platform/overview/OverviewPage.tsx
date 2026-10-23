import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { SectionTitle, wellClass } from "../components/cv-ui";
import { EvidenceTable, PlatformPage } from "../components/PlatformPage";
import { platformNavItems } from "../lib/navigation";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const shortcuts = [
  ["/platform/pos", "Ring up a sale"],
  ["/platform/fuel", "Fuel prices and tanks"],
  ["/platform/reconciliation", "Close the day"],
  ["/platform/inventory", "Count stock"],
  ["/platform/purchasing", "Receive a delivery"],
  ["/platform/exceptions", "Review exceptions"],
] as const;

export async function OverviewPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("overview", searchParams);
  const scope = new URLSearchParams(
    Object.entries({
      businessId: state.projection?.businessId ?? "",
      storeId: state.projection?.storeId ?? "",
    }).filter(([, value]) => value),
  ).toString();
  return (
    <PlatformPage title="Overview" {...state}>
      {state.projection ? (
        <>
          <section aria-labelledby="shortcuts-heading" className="min-w-0">
            <SectionTitle id="shortcuts-heading">Today</SectionTitle>
            <div className={`${wellClass} grid gap-1 sm:grid-cols-2 xl:grid-cols-3`}>
              {shortcuts.map(([href, label]) => {
                const item = platformNavItems.find((entry) => entry.href === href);
                const Icon = item?.icon;
                return (
                  <Link
                    key={href}
                    href={`/dashboard${href}${scope ? `?${scope}` : ""}`}
                    className="group flex min-h-14 min-w-0 items-center gap-3 rounded-xl bg-background px-4 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.1),0_0_0_0.5px_rgb(0_0_0/0.05)] transition hover:-translate-y-px hover:shadow-[0_3px_8px_rgb(0_0_0/0.08),0_0_0_0.5px_rgb(0_0_0/0.06)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-zinc-900"
                  >
                    {Icon ? (
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground"
                    />
                  </Link>
                );
              })}
            </div>
          </section>
          <EvidenceTable rows={state.projection.rows} timeZone={state.projection.timezone} title="Store days" />
        </>
      ) : null}
    </PlatformPage>
  );
}
