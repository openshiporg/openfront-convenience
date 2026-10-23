import { Dot, ListBand, SectionTitle } from "../components/cv-ui";
import { EmptyState } from "../components/PlatformPage";
import type { PlatformOption } from "../lib/projection";

/** Grade × tier with the price at the pump now and anything scheduled. */
export function FuelPriceBoard({ prices, timeZone }: { prices: PlatformOption[]; timeZone: string | null }) {
  // detail is "price|Current or Scheduled|ISO start" (see the fuel projection).
  const rows = prices.map((option) => {
    const [price = "", state = "", startsAt = ""] = (option.detail ?? "").split("|");
    return { id: option.id, label: option.label, price, state, startsAt };
  });
  const when = (value: string) => {
    try {
      return new Date(value).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short", timeZone: timeZone || "UTC" });
    } catch {
      return value;
    }
  };
  return (
    <section className="min-w-0" aria-label="Price board">
      <SectionTitle meta={rows.length || undefined}>Price board</SectionTitle>
      {rows.length ? (
        <ListBand>
          {rows.map((row) => (
            <div key={row.id} className="grid min-w-0 gap-x-6 gap-y-1 bg-background/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h3 className="text-sm font-medium">{row.label}</h3>
                  <span className="inline-flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
                    <Dot tone={row.state === "Current" ? "ok" : "warn"} />
                    {row.state}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">From {when(row.startsAt)}</p>
              </div>
              <p className="font-mono text-lg tabular-nums sm:text-right">{row.price}</p>
            </div>
          ))}
        </ListBand>
      ) : (
        <EmptyState title="No fuel prices set" />
      )}
    </section>
  );
}
