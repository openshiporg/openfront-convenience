import {
  activateLotteryPackAction,
  approveLotterySettlementAction,
  closeLotteryPackAction,
  configureLotteryGameAction,
  generateLotterySettlementAction,
  receiveLotteryPackAction,
  recordLotteryPackSaleAction,
} from "../actions";
import {
  ActionPanel,
  EnumField,
  EvidenceTable,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/lottery";

export async function LotteryPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("lottery", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return (
    <PlatformPage
      title="Lottery"
      description="Lottery games, packs, activations and daily settlement."
      {...state}
    >
      {projection ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">Merchant authorization required</p>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <ActionPanel
              title="Configure game"
              description="Creates or updates an operator/jurisdiction-labeled game without claiming approval."
            >
              <FormGrid action={configureLotteryGameAction} submit="Save game">
                <HiddenScope projection={projection} returnPath={path} />
                <TextField label="Game name" name="name" required />
                <TextField label="Game code" name="gameCode" required />
                <TextField
                  label="Jurisdiction label"
                  name="jurisdictionCode"
                  required
                />
                <TextField label="Operator name" name="operatorName" required />
                <TextField
                  label="Ticket price (cents)"
                  name="ticketPriceCents"
                  type="number"
                  min="1"
                  step="1"
                  required
                />
                <TextField
                  label="Tickets per pack"
                  name="ticketsPerPack"
                  type="number"
                  min="1"
                  step="1"
                  required
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Receive pack"
              description="Validates the serial range against configured pack size and records custody."
            >
              <FormGrid action={receiveLotteryPackAction} submit="Receive pack">
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Game"
                  name="gameId"
                  options={controls.lotteryGames ?? []}
                />
                <SelectField
                  label="Receiver"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField label="Pack number" name="packNumber" required />
                <TextField
                  label="First ticket number"
                  name="firstTicketNumber"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Last ticket number"
                  name="lastTicketNumber"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Activate pack"
              description="Moves a received pack into sale custody with employee and timestamp evidence."
            >
              <FormGrid
                action={activateLotteryPackAction}
                submit="Activate pack"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Received pack"
                  name="packId"
                  options={controls.lotteryPacks ?? []}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Record sold ticket range"
              description="Requires the next contiguous range and posts only the declared cash portion to the open till."
            >
              <FormGrid
                action={recordLotteryPackSaleAction}
                submit="Record range"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Activated pack"
                  name="packId"
                  options={controls.lotteryPacks ?? []}
                />
                <SelectField
                  label="Open register"
                  name="registerSessionId"
                  options={controls.registerSessions ?? []}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField
                  label="First ticket"
                  name="firstTicketNumber"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Last ticket"
                  name="lastTicketNumber"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Cash portion (cents)"
                  name="cashAmountCents"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Occurred at (optional ISO)"
                  name="occurredAt"
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Return or void remaining tickets"
              description="Closes unsold custody with an explicit returned or void-range event; returned tickets are not treated as sales."
            >
              <FormGrid action={closeLotteryPackAction} submit="Close pack">
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Open pack"
                  name="packId"
                  options={controls.lotteryPacks ?? []}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <EnumField
                  label="Disposition"
                  name="disposition"
                  values={[
                    { value: "returned", label: "Returned to operator" },
                    { value: "void_remaining", label: "Void remaining range" },
                  ]}
                />
                <TextField label="Reason" name="reason" required />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Generate daily settlement"
              description="Combines recorded instant-ticket ranges with operator-reported online sales, payouts, commission, and settlement."
            >
              <FormGrid
                action={generateLotterySettlementAction}
                submit="Generate settlement"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <TextField
                  label="Trading date"
                  name="tradingDate"
                  type="date"
                  required
                />
                <TextField label="Operator name" name="operatorName" required />
                <TextField
                  label="Period start (ISO)"
                  name="periodStartedAt"
                  required
                />
                <TextField
                  label="Period end (ISO)"
                  name="periodEndedAt"
                  required
                />
                <TextField
                  label="Online sales (cents)"
                  name="onlineSalesCents"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
                <TextField
                  label="Payouts (cents)"
                  name="payoutCents"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
                <TextField
                  label="Commission (cents)"
                  name="commissionCents"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
                <TextField
                  label="Reported settlement (cents)"
                  name="reportedSettlementCents"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Approve settlement"
              description="Generate StoreDay evidence with the exact trading date and period first; non-zero variance also requires a manager disposition note."
            >
              <FormGrid
                action={approveLotterySettlementAction}
                submit="Approve settlement"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Settlement"
                  name="settlementId"
                  options={controls.lotterySettlements ?? []}
                />
                <SelectField
                  label="Approver"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField label="Disposition notes" name="notes" />
              </FormGrid>
            </ActionPanel>
          </div>
          <EvidenceTable
            rows={projection.rows}
            title="Pack custody and sales"
          />
        </>
      ) : null}
    </PlatformPage>
  );
}
