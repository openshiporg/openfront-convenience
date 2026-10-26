import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { DetailSection, PlatformDetailShell } from "../../components/PlatformDetailShell";
import {
  CountBoxes,
  DataTable,
  StatusText,
  Td,
  Th,
  Tr,
  primaryButtonClass,
  statusLabel,
  statusTone,
  type DotTone,
} from "../../components/cv-ui";
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
  const closed = session.status === "closed";
  const stateLabel = closed
    ? session.overShortCents == null
      ? "Closed"
      : variance === 0
        ? "Closed, balanced"
        : variance < 0
          ? `Closed ${money(Math.abs(variance))} short`
          : `Closed ${money(variance)} over`
    : session.status === "closing"
      ? "Counting the drawer"
      : session.status === "suspended"
        ? "Suspended"
        : "Open, taking sales";
  const stateTone: DotTone = closed ? (variance < 0 ? "danger" : "ok") : statusTone(session.status);
  return (
    <PlatformDetailShell
      section="Tills"
      sectionHref={`/dashboard/platform/tills${q}`}
      title={`${session.register?.name ?? "Till"} · ${shortRef(session.sessionNumber)}`}
      state={{ tone: stateTone, label: stateLabel }}
      meta={`${employeeName(session.employee)} · opened ${formatWhen(session.openedAt, scope.timezone)}`}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
    >
      {!closed ? (
        <div className="flex flex-wrap gap-2">
          <Link className={primaryButtonClass} href={`/dashboard/platform/pos${q}#till`}>
            Cash movement or close
          </Link>
        </div>
      ) : null}
      <CountBoxes
        items={[
          { label: "Opening float", value: money(session.openingCashCents) },
          { label: "Expected", value: money(session.expectedCashCents) },
          { label: "Counted", value: session.countedCashCents == null ? "—" : money(session.countedCashCents), note: session.countedCashCents == null ? "Not counted" : undefined },
          {
            label: "Over / short",
            value: closed && session.overShortCents != null ? (variance === 0 ? money(0) : `${variance > 0 ? "+" : "−"}${money(Math.abs(variance))}`) : "—",
            variance: closed && session.overShortCents != null ? variance : null,
            note: closed && session.overShortCents != null ? (variance === 0 ? "Balanced" : variance < 0 ? "Short" : "Over") : "Counted at close",
          },
        ]}
      />
      <dl className="grid min-w-0 gap-x-8 text-[13px] sm:grid-cols-2">
        {[
          ["Register", session.register ? `${session.register.name}${session.register.code ? ` · ${session.register.code}` : ""}` : "—"],
          ["Cashier", employeeName(session.employee)],
          ["Opened", formatWhen(session.openedAt, scope.timezone)],
          ["Count started", session.closingStartedAt ? formatWhen(session.closingStartedAt, scope.timezone) : "—"],
          ["Closed", session.closedAt ? formatWhen(session.closedAt, scope.timezone) : "Open"],
          ["Shift", session.shift ? shortRef(session.shift.shiftNumber) : "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex min-w-0 items-baseline justify-between gap-4 border-b py-2">
            <dt className="shrink-0 text-[12px] font-medium text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right text-foreground [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      {session.closingNotes ? <p className="text-sm text-muted-foreground">{session.closingNotes}</p> : null}
      <DetailSection title="Cash movements" meta={session.cashMovements.length}>
        {session.cashMovements.length ? (
          <DataTable aria-label="Cash movements">
            <thead>
              <tr>
                <Th>Type</Th>
                <Th priority={2}>When</Th>
                <Th priority={3}>By</Th>
                <Th priority={2}>Reason</Th>
                <Th priority={3}>Receipt</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {session.cashMovements.map((movement) => (
                <Tr key={movement.id}>
                  <Td className="font-medium">{statusLabel(movement.type)}</Td>
                  <Td priority={2} className="whitespace-nowrap text-muted-foreground">{formatWhen(movement.occurredAt, scope.timezone)}</Td>
                  <Td priority={3} className="text-muted-foreground">{employeeName(movement.employee)}</Td>
                  <Td priority={2} className="text-muted-foreground">{movement.reason || "—"}</Td>
                  <Td priority={3}>
                    {movement.sale ? (
                      <Link className="font-mono text-[12px] hover:underline" href={`/dashboard/platform/sales/${movement.sale.id}${q}`}>
                        {shortRef(movement.sale.receiptNumber)}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td align="right" className="whitespace-nowrap">{`${movement.direction === "out" ? "−" : "+"}${money(movement.amountCents)}`}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <p className="text-sm text-muted-foreground">No cash movements</p>
        )}
      </DetailSection>
      <DetailSection title="Sales" meta={session.sales.length}>
        {session.sales.length ? (
          <DataTable aria-label="Sales on this till">
            <thead>
              <tr>
                <Th>Receipt</Th>
                <Th priority={2}>Completed</Th>
                <Th align="right">Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {session.sales.map((sale) => (
                <Tr key={sale.id}>
                  <Td>
                    <Link className="inline-flex min-h-6 items-center font-mono text-[12px] font-medium hover:underline max-sm:min-h-10" href={`/dashboard/platform/sales/${sale.id}${q}`}>
                      {shortRef(sale.receiptNumber)}
                    </Link>
                  </Td>
                  <Td priority={2} className="whitespace-nowrap text-muted-foreground">{formatWhen(sale.completedAt, scope.timezone)}</Td>
                  <Td align="right">{money(sale.totalCents)}</Td>
                  <Td><StatusText status={sale.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <p className="text-sm text-muted-foreground">No sales</p>
        )}
      </DetailSection>
    </PlatformDetailShell>
  );
}
