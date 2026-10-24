import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { BandRow, DetailSection, FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ListBand, pillClass, statusLabel, trackClass } from "../../components/cv-ui";
import { shortRef } from "../../lib/labels";
import { employeeName, type EmployeeRef } from "../../lib/people";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

type Session = {
  id: string;
  sessionNumber: string;
  status: string;
  openingCashCents: number;
  expectedCashCents: number;
  countedCashCents: number | null;
  overShortCents: number | null;
  openedAt: string | null;
  closingStartedAt: string | null;
  closedAt: string | null;
  closingNotes: string;
  register: { name: string; code: string } | null;
  employee: EmployeeRef;
  shift: { shiftNumber: string } | null;
  cashMovements: Array<{ id: string; type: string; direction: string; amountCents: number; reason: string; occurredAt: string | null; employee: EmployeeRef; sale: { id: string; receiptNumber: string } | null }>;
  sales: Array<{ id: string; receiptNumber: string; status: string; totalCents: number; completedAt: string | null }>;
};

export async function TillDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PlatformSearch }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const scope = await getPlatformScope(search);
  const response = await keystoneClient<{ registerSession: Session | null }>(
    `query PlatformTill($id: ID!) {
      registerSession(where: { id: $id }) {
        id sessionNumber status openingCashCents expectedCashCents countedCashCents overShortCents openedAt closingStartedAt closedAt closingNotes
        register { name code }
        employee { employeeNumber user { name } }
        shift { shiftNumber }
        cashMovements(orderBy: { occurredAt: desc }, take: 100) { id type direction amountCents reason occurredAt employee { employeeNumber user { name } } sale { id receiptNumber } }
        sales(orderBy: { completedAt: desc }, take: 50) { id receiptNumber status totalCents completedAt }
      }
    }`,
    { id },
  );
  if (!response.success || !response.data.registerSession) notFound();
  const session = response.data.registerSession;
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, scope.currencyCode);
  const q = scopeQuery(scope);
  const variance = session.overShortCents ?? 0;
  return (
    <PlatformDetailShell
      section="Tills"
      sectionHref={`/dashboard/platform/tills${q}`}
      title={`${session.register?.name ?? "Till"} · ${shortRef(session.sessionNumber)}`}
      status={session.status}
      meta={`${employeeName(session.employee)} · opened ${formatWhen(session.openedAt, scope.timezone)}`}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
    >
      <FactList
        facts={[
          ["Opening float", money(session.openingCashCents)],
          ["Expected in drawer", money(session.expectedCashCents)],
          ["Counted", session.countedCashCents == null ? "Not counted" : money(session.countedCashCents)],
          ["Over / short", session.status === "closed" ? (variance === 0 ? "Balanced" : `${variance > 0 ? "Over" : "Short"} ${money(Math.abs(variance))}`) : "—"],
          ["Closed", session.closedAt ? formatWhen(session.closedAt, scope.timezone) : "Open"],
          ["Shift", session.shift ? shortRef(session.shift.shiftNumber) : "—"],
        ]}
      />
      {session.closingNotes ? <p className="text-sm text-muted-foreground">{session.closingNotes}</p> : null}
      {session.status !== "closed" ? (
        <div className={trackClass}>
          <Link className={pillClass} href={`/dashboard/platform/pos${q}#till`}>
            Cash movement or close
          </Link>
        </div>
      ) : null}
      <DetailSection title="Cash movements" meta={session.cashMovements.length}>
        {session.cashMovements.length ? (
          <ListBand>
            {session.cashMovements.map((movement) => (
              <BandRow
                key={movement.id}
                title={statusLabel(movement.type)}
                meta={[
                  formatWhen(movement.occurredAt, scope.timezone),
                  employeeName(movement.employee),
                  movement.reason || null,
                  movement.sale ? shortRef(movement.sale.receiptNumber) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                figure={`${movement.direction === "out" ? "−" : "+"}${money(movement.amountCents)}`}
              />
            ))}
          </ListBand>
        ) : (
          <p className="text-sm text-muted-foreground">No cash movements</p>
        )}
      </DetailSection>
      <DetailSection title="Sales" meta={session.sales.length}>
        {session.sales.length ? (
          <ListBand>
            {session.sales.map((sale) => (
              <Link key={sale.id} href={`/dashboard/platform/sales/${sale.id}${q}`} className="block hover:bg-background">
                <BandRow title={shortRef(sale.receiptNumber)} status={sale.status} meta={formatWhen(sale.completedAt, scope.timezone)} figure={money(sale.totalCents)} />
              </Link>
            ))}
          </ListBand>
        ) : (
          <p className="text-sm text-muted-foreground">No sales</p>
        )}
      </DetailSection>
    </PlatformDetailShell>
  );
}
