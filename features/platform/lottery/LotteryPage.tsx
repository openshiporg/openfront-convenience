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
import { PanelGrid } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
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
      title="Lottery" state={{ tone: "warn", label: "Merchant authorization required" }}
      {...state}
    >
      {projection ? (
        <Workbench
          scope="lottery"
          sections={[
            {
              id: "sales",
              label: "Ticket sales",
              content: (
                <PanelGrid>
                  <ActionPanel title="Record sold ticket range">
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
                  <ActionPanel title="Return or void remaining tickets">
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
                </PanelGrid>
              ),
            },
            {
              id: "packs",
              label: "Packs",
              count: projection.rows.length,
              content: (
                <>
                  <PanelGrid>
                    <ActionPanel title="Receive pack">
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
                    <ActionPanel title="Activate pack">
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
                  </PanelGrid>
                  <EvidenceTable
                    rows={projection.rows}
                    timeZone={projection.timezone}
                    title="Pack custody and sales"
                  />
                </>
              ),
            },
            {
              id: "settlement",
              label: "Settlement",
              content: (
                <PanelGrid>
                  <ActionPanel title="Generate daily settlement">
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
                  <ActionPanel title="Approve settlement">
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
                </PanelGrid>
              ),
            },
            {
              id: "games",
              label: "Games",
              content: (
                <PanelGrid>
                  <ActionPanel title="Configure game">
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
                </PanelGrid>
              ),
            },
          ]}
        />
      ) : null}
    </PlatformPage>
  );
}
