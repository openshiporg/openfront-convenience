import { DataTable, SectionTitle, Td, Th, Tr } from "../components/cv-ui";
import { EmptyState } from "../components/PlatformPage";
import type { PlatformOption } from "../lib/projection";
import { ToneText, When } from "./ops-kit";

/** Grade × tier with the price at the pump now and anything scheduled; grades with no price are called out. */
export function FuelPriceBoard({
  prices,
  timeZone,
  grades = [],
  title = "Posted prices",
}: {
  prices: PlatformOption[];
  timeZone: string | null;
  grades?: PlatformOption[];
  title?: string;
}) {
  // detail is "price|Current or Scheduled|ISO start" (see the fuel projection).
  const rows = prices.map((option) => {
    const [price = "", state = "", startsAt = ""] = (option.detail ?? "").split("|");
    const [grade = option.label, tier = ""] = option.label.split(" · ");
    return { id: option.id, grade, tier, price, state, startsAt };
  });
  const unpriced = grades.filter(
    (grade) => !rows.some((row) => row.grade === grade.label && row.state === "Current"),
  );
  return (
    <section className="min-w-0" aria-label={title}>
      <SectionTitle meta={rows.length || undefined}>{title}</SectionTitle>
      {rows.length || unpriced.length ? (
        <DataTable>
          <thead>
            <tr>
              <Th>Grade</Th>
              <Th>Tier</Th>
              <Th align="right">Price</Th>
              <Th>State</Th>
              <Th priority={2}>From</Th>
            </tr>
          </thead>
          <tbody>
            {unpriced.map((grade) => (
              <Tr key={`unpriced-${grade.id}`}>
                <Td className="font-medium">{grade.label}</Td>
                <Td className="text-muted-foreground">—</Td>
                <Td align="right" className="text-muted-foreground">—</Td>
                <Td>
                  <ToneText tone="danger">No current price</ToneText>
                </Td>
                <Td priority={2} />
              </Tr>
            ))}
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td className="font-medium">{row.grade}</Td>
                <Td className="text-muted-foreground">{row.tier || "—"}</Td>
                <Td align="right" className="text-[14px] text-foreground">
                  {row.price}
                </Td>
                <Td>
                  <ToneText tone={row.state === "Current" ? "ok" : "info"}>{row.state}</ToneText>
                </Td>
                <Td priority={2}>
                  <When value={row.startsAt} timeZone={timeZone} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <EmptyState title="No fuel prices set" />
      )}
    </section>
  );
}
