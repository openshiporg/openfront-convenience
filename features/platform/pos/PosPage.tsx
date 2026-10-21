import {
  addPosLineAction,
  applyLoyaltyRedemptionAction,
  applyPosPromotionAction,
  closeShiftAction,
  createPosCartAction,
  openRegisterAction,
  openShiftAction,
  recordCashAction,
  setOwnPosPinAction,
  removePosLineAction,
  transitionPosCartAction,
  updatePosLineAction,
  voidCompletedPosSaleAction,
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
import { DurableOfflineQueue } from "./DurableOfflineQueue";
import { FastCheckoutStation } from "./FastCheckoutStation";
import { ReceiptLookup } from "./ReceiptLookup";
import { DurableRegisterClose } from "./DurableRegisterClose";
import { DurableRetailForm } from "./DurableRetailForm";
import { registerCloseActorId } from "./register-close-actions";

const path = "/dashboard/platform/pos";

export async function PosPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("pos", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const closeActorId = projection ? await registerCloseActorId() : "";
  const recentCartOptions = controls.carts ?? [];
  const searchedCartOptions = state.posCartSearch
    ? (controls.posCartLookup ?? []).filter(
        (searched) =>
          !recentCartOptions.some((recent) => recent.id === searched.id),
      )
    : [];
  const cartActionOptions = [...recentCartOptions, ...searchedCartOptions];
  const voidSaleOptions = state.voidReceiptSearch
    ? (controls.posVoidHistorySales ?? [])
    : (controls.sales ?? []);
  const voidRegisterSessionOptions = state.voidReceiptSearch
    ? (controls.posVoidRegisterSessions ?? [])
    : (controls.registerSessions ?? []);
  return (
    <PlatformPage
      title="POS & Cash"
      description="Ring up sales, take payment, issue refunds and manage tills."
      {...state}
    >
      {projection ? (
        <>

          <section
            aria-label="Search POS item fallback options"
            className="grid min-w-0 gap-2 border bg-background p-4"
          >
            <form
              action={path}
              method="get"
              className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            >
              <input
                type="hidden"
                name="businessId"
                value={projection.businessId ?? ""}
              />
              <input
                type="hidden"
                name="storeId"
                value={projection.storeId ?? ""}
              />
              <input
                type="hidden"
                name="receiptSearch"
                value={state.receiptSearch ?? ""}
              />
              <input
                type="hidden"
                name="refundHistorySearch"
                value={state.refundHistorySearch ?? ""}
              />
              <input
                type="hidden"
                name="voidReceiptSearch"
                value={state.voidReceiptSearch ?? ""}
              />
              <input
                type="hidden"
                name="posCartSearch"
                value={state.posCartSearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Find an item by title or SKU
                <input
                  type="search"
                  name="posVariantSearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.posVariantSearch ?? ""}
                  placeholder="Search active item title or SKU"
                  className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                Search items
              </button>
            </form>
            {state.posVariantSearch && !controls.productVariants?.length ? (
              <p className="text-sm text-muted-foreground" role="status">
                No matching active item option is available for this authorized
                business.
              </p>
            ) : null}
          </section>

          <section
            aria-label="Find an open or held POS basket"
            className="grid min-w-0 gap-2 border bg-background p-4"
          >
            <form
              action={path}
              method="get"
              className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            >
              <input
                type="hidden"
                name="businessId"
                value={projection.businessId ?? ""}
              />
              <input
                type="hidden"
                name="storeId"
                value={projection.storeId ?? ""}
              />
              <input
                type="hidden"
                name="receiptSearch"
                value={state.receiptSearch ?? ""}
              />
              <input
                type="hidden"
                name="refundHistorySearch"
                value={state.refundHistorySearch ?? ""}
              />
              <input
                type="hidden"
                name="voidReceiptSearch"
                value={state.voidReceiptSearch ?? ""}
              />
              <input
                type="hidden"
                name="posVariantSearch"
                value={state.posVariantSearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Exact cart number
                <input
                  type="search"
                  name="posCartSearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.posCartSearch ?? ""}
                  placeholder="Enter the full cart number"
                  className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                Find basket
              </button>
            </form>
            {state.posCartSearch && !controls.posCartLookup?.length ? (
              <p className="text-sm text-muted-foreground" role="status">
                No exact open or held basket is available in this authorized
                store.
              </p>
            ) : null}
          </section>

          <FastCheckoutStation
            businessId={projection.businessId!}
            storeId={projection.storeId!}
            carts={cartActionOptions}
            registerSessions={controls.registerSessions ?? []}
            employees={controls.employees ?? []}
            variants={controls.productVariants ?? []}
          />

          <section className="space-y-3" aria-labelledby="checkout-heading">
            <div>
              <h2 id="checkout-heading" className="text-lg font-semibold">
                Advanced tender and basket controls
              </h2>
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              <ActionPanel
                title="1 · Start basket"
                description="Binds the basket to an open till, cashier, store, and optional loyalty account."
              >
                <FormGrid action={createPosCartAction} submit="Start basket">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Open register session"
                    name="registerSessionId"
                    options={controls.registerSessions ?? []}
                  />
                  <SelectField
                    label="Cashier"
                    name="employeeId"
                    options={controls.employees ?? []}
                  />
                  <TextField label="Customer account ID (optional)" name="customerId" />
                  <SelectField
                    label="Loyalty account (optional)"
                    name="loyaltyAccountId"
                    options={controls.loyaltyAccounts ?? []}
                    required={false}
                  />
                </FormGrid>
              </ActionPanel>
              <ActionPanel
                title="2 · Scan or add item"
                description={
                  controls.productVariants?.length
                    ? "Resolves an active barcode or authorized variant, current pricing, tax, and restricted-sale flags on the server."
                    : "Resolves scanned barcodes and applies current pricing, tax, and restricted-sale checks on the server."
                }
              >
                <FormGrid action={addPosLineAction} submit="Add item">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Open basket"
                    name="cartId"
                    options={cartActionOptions}
                  />
                  <TextField
                    label="Barcode / PLU"
                    name="barcode"
                    inputMode="numeric"
                  />
                  {controls.productVariants?.length ? (
                    <SelectField
                      label="Variant when no barcode"
                      name="variantId"
                      options={controls.productVariants}
                      required={false}
                    />
                  ) : null}
                  <TextField
                    label="Quantity"
                    name="quantity"
                    inputMode="decimal"
                    defaultValue="1"
                    required
                  />
                </FormGrid>
              </ActionPanel>
              {controls.promotions?.length ? (
                <ActionPanel
                  title="3 · Apply promotion"
                  description="Evaluates the selected active promotion against current basket lines and usage limits."
                >
                  <FormGrid
                    action={applyPosPromotionAction}
                    submit="Apply promotion"
                  >
                    <HiddenScope projection={projection} returnPath={path} />
                    <SelectField
                      label="Open basket"
                      name="cartId"
                      options={cartActionOptions}
                    />
                    <SelectField
                      label="Promotion"
                      name="promotionId"
                      options={controls.promotions}
                    />
                    <TextField label="Required code, if any" name="code" />
                  </FormGrid>
                </ActionPanel>
              ) : null}
              <ActionPanel
                title="Apply loyalty points"
                description="Reserves configured redemption increments on an identified loyalty basket and revalidates the balance atomically at checkout."
              >
                <FormGrid
                  action={applyLoyaltyRedemptionAction}
                  submit="Apply points"
                >
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Open loyalty basket"
                    name="cartId"
                    options={cartActionOptions}
                  />
                  <TextField
                    label="Points to redeem"
                    name="points"
                    type="number"
                    min="1"
                    step="1"
                    required
                  />
                </FormGrid>
              </ActionPanel>
              <ActionPanel
                title="4 · Tender and issue receipt"
                description="Applied tender must equal the server total. Non-cash requires a configured provider and externally confirmed payment reference."
              >
                <DurableRetailForm userId={closeActorId} businessId={projection.businessId ?? ""} storeId={projection.storeId ?? ""} purpose="completePosSale" label="Complete sale">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Open basket"
                    name="cartId"
                    options={cartActionOptions}
                  />
                  <EnumField
                    label="Tender"
                    name="method"
                    values={[
                      { value: "cash", label: "Cash" },
                      { value: "credit_card", label: "Credit card" },
                      { value: "debit_card", label: "Debit card" },
                      { value: "mobile_wallet", label: "Mobile wallet" },
                      { value: "fleet_card", label: "Fleet card" },
                    ]}
                  />
                  <TextField
                    label="Applied amount (cents)"
                    name="amountCents"
                    type="number"
                    min="0"
                    step="1"
                    required
                  />
                  <TextField
                    label="Cash tendered (cents)"
                    name="tenderedCents"
                    type="number"
                    min="0"
                    step="1"
                  />
                  <SelectField
                    label="Provider for non-cash"
                    name="paymentProviderId"
                    options={controls.paymentProviders ?? []}
                    required={false}
                  />
                  <TextField
                    label="Confirmed provider reference"
                    name="providerPaymentId"
                  />
                  <TextField
                    label="Provider approval code"
                    name="providerAuthority"
                    placeholder="v2=timestamp.signature"
                  />
                  <TextField label="Card brand (optional)" name="cardBrand" />
                  <TextField
                    label="Card last four (optional)"
                    name="cardLast4"
                    inputMode="numeric"
                    maxLength={4}
                  />
                  <EnumField
                    label="Second tender (optional)"
                    name="method2"
                    values={[
                      { value: "", label: "No second tender" },
                      { value: "cash", label: "Cash" },
                      { value: "credit_card", label: "Credit card" },
                      { value: "debit_card", label: "Debit card" },
                      { value: "mobile_wallet", label: "Mobile wallet" },
                      { value: "fleet_card", label: "Fleet card" },
                    ]}
                  />
                  <TextField
                    label="Second applied amount (cents)"
                    name="amountCents2"
                    type="number"
                    min="0"
                    step="1"
                  />
                  <TextField
                    label="Second cash tendered (cents)"
                    name="tenderedCents2"
                    type="number"
                    min="0"
                    step="1"
                  />
                  <SelectField
                    label="Second provider"
                    name="paymentProviderId2"
                    options={controls.paymentProviders ?? []}
                    required={false}
                  />
                  <TextField
                    label="Second provider reference"
                    name="providerPaymentId2"
                  />
                  <TextField
                    label="Second provider approval code"
                    name="providerAuthority2"
                    placeholder="v2=timestamp.signature"
                  />
                  <TextField label="Second card brand" name="cardBrand2" />
                  <TextField
                    label="Second card last four"
                    name="cardLast42"
                    inputMode="numeric"
                    maxLength={4}
                  />
                </DurableRetailForm>
              </ActionPanel>
            </div>
          </section>

          <ReceiptLookup
            businessId={projection.businessId!}
            storeId={projection.storeId!}
            sales={controls.receiptLookupSales ?? []}
            search={state.receiptSearch}
          />

          {controls.offlineDevices?.length ? (
            <DurableOfflineQueue
              businessId={projection.businessId!}
              storeId={projection.storeId!}
              devices={controls.offlineDevices}
              carts={controls.carts ?? []}
              cartLines={controls.cartLines ?? []}
              variants={controls.productVariants ?? []}
              employees={controls.employees ?? []}
            />
          ) : null}

          <section className="space-y-3" aria-labelledby="correction-heading">
            <div>
              <h2 id="correction-heading" className="text-lg font-semibold">
                Basket correction and hold
              </h2>
            </div>
            <div className="grid min-w-0 gap-4 xl:grid-cols-3">
              <ActionPanel
                title="Change line quantity"
                description="Recalculates the line and basket from server snapshots; quantity must remain positive."
              >
                <FormGrid action={updatePosLineAction} submit="Update quantity">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Open basket"
                    name="cartId"
                    options={controls.carts ?? []}
                  />
                  <SelectField
                    label="Basket line"
                    name="cartLineId"
                    options={controls.cartLines ?? []}
                  />
                  <TextField
                    label="New quantity"
                    name="quantity"
                    inputMode="decimal"
                    required
                  />
                  <SelectField
                    label="Manager"
                    name="employeeId"
                    options={controls.employees ?? []}
                  />
                  <TextField label="Correction reason" name="reason" required />
                  <TextField
                    label="Manager PIN"
                    name="managerPin"
                    type="password"
                    inputMode="numeric"
                    required
                  />
                </FormGrid>
              </ActionPanel>
              <ActionPanel
                title="Remove basket line"
                description="Deletes only an unposted draft line and leaves auditable operation evidence."
              >
                <FormGrid action={removePosLineAction} submit="Remove line">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Open basket"
                    name="cartId"
                    options={controls.carts ?? []}
                  />
                  <SelectField
                    label="Basket line"
                    name="cartLineId"
                    options={controls.cartLines ?? []}
                  />
                  <SelectField
                    label="Manager"
                    name="employeeId"
                    options={controls.employees ?? []}
                  />
                  <TextField label="Removal reason" name="reason" required />
                  <TextField
                    label="Manager PIN"
                    name="managerPin"
                    type="password"
                    inputMode="numeric"
                    required
                  />
                </FormGrid>
              </ActionPanel>
              <ActionPanel
                title="Hold, resume, or void basket"
                description="Held baskets cannot be edited or tendered until resumed; void and abandon are terminal."
              >
                <FormGrid
                  action={transitionPosCartAction}
                  submit="Change basket state"
                >
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Basket"
                    name="cartId"
                    options={cartActionOptions}
                  />
                  <EnumField
                    label="Next state"
                    name="nextStatus"
                    values={[
                      { value: "held", label: "Hold" },
                      { value: "open", label: "Resume" },
                      { value: "voided", label: "Void" },
                      { value: "abandoned", label: "Abandon" },
                    ]}
                  />
                  <TextField label="Reason for terminal state" name="reason" />
                </FormGrid>
              </ActionPanel>
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="register-heading">
            <h2 id="register-heading" className="text-lg font-semibold">
              Shift and till control
            </h2>
            <div className="grid min-w-0 gap-4 xl:grid-cols-3">
              <ActionPanel
                title="Set my POS PIN"
                description="Binds a 6-12 digit bcrypt-protected challenge to the authenticated employee for corrections, overrides, and completed-sale voids."
              >
                <FormGrid action={setOwnPosPinAction} submit="Set PIN">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="My employee identity"
                    name="employeeId"
                    options={controls.employees ?? []}
                  />
                  <TextField
                    label="New POS PIN"
                    name="newPin"
                    type="password"
                    inputMode="numeric"
                    minLength={6}
                    maxLength={12}
                    required
                  />
                </FormGrid>
              </ActionPanel>
              <ActionPanel
                title="Clock in"
                description="Creates one employee shift; overlapping open shifts are rejected."
              >
                <FormGrid action={openShiftAction} submit="Open shift">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Employee"
                    name="employeeId"
                    options={controls.employees ?? []}
                  />
                  <TextField
                    label="Role snapshot"
                    name="roleSnapshot"
                    placeholder="Shift lead"
                  />
                  <TextField
                    label="Starts at (ISO + offset)"
                    name="startsAt"
                    placeholder="2026-07-29T08:00:00-04:00"
                    required
                  />
                  <TextField
                    label="Ends at (ISO + offset)"
                    name="endsAt"
                    placeholder="2026-07-29T16:00:00-04:00"
                    required
                  />
                </FormGrid>
              </ActionPanel>
              <ActionPanel
                title="Open till"
                description="Captures opening float and matching immutable cash movement atomically."
              >
                <FormGrid action={openRegisterAction} submit="Open register">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Register"
                    name="registerId"
                    options={controls.registers ?? []}
                  />
                  <SelectField
                    label="Employee"
                    name="employeeId"
                    options={controls.employees ?? []}
                  />
                  <SelectField
                    label="Open shift"
                    name="shiftId"
                    options={controls.shifts ?? []}
                    required={false}
                  />
                  <TextField
                    label="Opening cash (cents)"
                    name="openingCashCents"
                    type="number"
                    min="0"
                    step="1"
                    required
                  />
                </FormGrid>
              </ActionPanel>
              <ActionPanel
                title="Paid in, paid out, safe drop"
                description="Serializes cash movement against the till and rejects a negative expected drawer."
              >
                <FormGrid action={recordCashAction} submit="Post movement">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Open register session"
                    name="registerSessionId"
                    options={controls.registerSessions ?? []}
                  />
                  <SelectField
                    label="Employee"
                    name="employeeId"
                    options={controls.employees ?? []}
                  />
                  <EnumField
                    label="Movement"
                    name="type"
                    values={[
                      { value: "paid_in", label: "Paid in" },
                      { value: "paid_out", label: "Paid out" },
                      { value: "safe_drop", label: "Safe drop" },
                      { value: "correction", label: "Correction" },
                    ]}
                  />
                  <EnumField
                    label="Direction"
                    name="direction"
                    values={[
                      { value: "in", label: "In" },
                      { value: "out", label: "Out" },
                    ]}
                  />
                  <TextField
                    label="Amount (cents)"
                    name="amountCents"
                    type="number"
                    min="0"
                    step="1"
                    required
                  />
                  <TextField label="Reason" name="reason" required />
                </FormGrid>
              </ActionPanel>
              <ActionPanel
                title="Count and close till"
                description="Snapshots counted cash and over/short; closed sessions feed store-day reconciliation."
              >
                <DurableRegisterClose userId={closeActorId} businessId={projection.businessId ?? ""} storeId={projection.storeId ?? ""}>
                  <SelectField
                    label="Open register session"
                    name="registerSessionId"
                    options={controls.registerSessions ?? []}
                  />
                  <TextField
                    label="Counted cash (cents)"
                    name="countedCashCents"
                    type="number"
                    min="0"
                    step="1"
                    required
                  />
                  <TextField label="Closing notes" name="notes" />
                </DurableRegisterClose>
              </ActionPanel>
              <ActionPanel
                title="Close shift"
                description="Clocks out an active employee shift after till work is complete."
              >
                <FormGrid action={closeShiftAction} submit="Close shift">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField
                    label="Open shift"
                    name="shiftId"
                    options={controls.shifts ?? []}
                  />
                  <TextField label="Notes" name="notes" />
                </FormGrid>
              </ActionPanel>
            </div>
          </section>

          <section
            aria-label="Find sale for refund or correction"
            className="grid min-w-0 gap-2 border bg-background p-4"
          >
            <form
              action={path}
              method="get"
              className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            >
              <input
                type="hidden"
                name="businessId"
                value={projection.businessId ?? ""}
              />
              <input
                type="hidden"
                name="storeId"
                value={projection.storeId ?? ""}
              />
              <input
                type="hidden"
                name="receiptSearch"
                value={state.receiptSearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Exact receipt number for refund/correction history
                <input
                  type="search"
                  name="refundHistorySearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.refundHistorySearch ?? ""}
                  placeholder="Enter the full receipt number"
                  className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                Find refund history
              </button>
            </form>
            {state.refundHistorySearch && !controls.refundSales?.length ? (
              <p className="text-sm text-muted-foreground" role="status">
                No exact receipt match is available in this authorized store.
              </p>
            ) : null}
          </section>
          <ActionPanel
            title="Refund and return one sale line"
            description="Validates original tender, refundable quantity, provider reference, inventory disposition, loyalty reversal, and original-lot restoration."
          >
            <DurableRetailForm userId={closeActorId} businessId={projection.businessId ?? ""} storeId={projection.storeId ?? ""} purpose="refundPosSale" label="Complete refund">
              <HiddenScope projection={projection} returnPath={path} />
              <SelectField
                label="Sale"
                name="saleId"
                options={controls.refundSales ?? []}
              />
              <SelectField
                label="Original tender"
                name="originalTenderId"
                options={controls.refundTenders ?? []}
              />
              <TextField
                label="First allocation (cents; set for split refund)"
                name="refundAllocationCents"
                type="number"
                min="0"
                step="1"
              />
              <SelectField
                label="Second original tender (optional)"
                name="originalTenderId2"
                options={controls.refundTenders ?? []}
                required={false}
              />
              <TextField
                label="Second allocation (cents)"
                name="refundAllocationCents2"
                type="number"
                min="0"
                step="1"
              />
              <SelectField
                label="Sale line"
                name="saleLineId"
                options={controls.refundSaleLines ?? []}
              />
              <SelectField
                label="Open register session"
                name="registerSessionId"
                options={controls.registerSessions ?? []}
              />
              <SelectField
                label="Processor"
                name="employeeId"
                options={controls.employees ?? []}
              />
              <TextField
                label="Return quantity"
                name="quantity"
                inputMode="decimal"
                defaultValue="1"
                required
              />
              <EnumField
                label="Refund reason"
                name="reason"
                values={[
                  { value: "customer_return", label: "Customer return" },
                  { value: "price_correction", label: "Price correction" },
                  { value: "duplicate_charge", label: "Duplicate charge" },
                  { value: "service_recovery", label: "Service recovery" },
                  { value: "other", label: "Other" },
                ]}
              />
              <EnumField
                label="Disposition"
                name="disposition"
                values={[
                  { value: "restock", label: "Restock" },
                  { value: "quarantine", label: "Quarantine" },
                  { value: "destroy", label: "Destroy / waste" },
                  { value: "return_to_vendor", label: "Return to vendor" },
                  {
                    value: "no_inventory_action",
                    label: "No inventory action",
                  },
                ]}
              />
              <EnumField
                label="Condition"
                name="condition"
                values={[
                  { value: "sealed", label: "Sealed" },
                  { value: "opened", label: "Opened" },
                  { value: "damaged", label: "Damaged" },
                  { value: "expired", label: "Expired" },
                  { value: "unknown", label: "Unknown" },
                ]}
              />
              <TextField
                label="Provider refund reference for non-cash"
                name="providerRefundId"
              />
              <TextField
                label="Context-bound refund authority (v2)"
                name="providerAuthority"
                placeholder="v2=timestamp.signature"
              />
              <TextField
                label="Second provider refund reference"
                name="providerRefundId2"
              />
              <TextField
                label="Second context-bound refund authority (v2)"
                name="providerAuthority2"
                placeholder="v2=timestamp.signature"
              />
              <EnumField
                label="Override non-returnable product"
                name="overrideNonReturnable"
                values={[
                  { value: "false", label: "No" },
                  { value: "true", label: "Manager override" },
                ]}
              />
              <TextField label="Override reason" name="overrideReason" />
              <TextField
                label="Manager PIN for override"
                name="managerPin"
                type="password"
                inputMode="numeric"
              />
              <TextField label="Notes" name="notes" />
            </DurableRetailForm>
          </ActionPanel>

          <section
            aria-label="Find a completed cash sale for void"
            className="grid min-w-0 gap-2 border bg-background p-4"
          >
            <form
              action={path}
              method="get"
              className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            >
              <input
                type="hidden"
                name="businessId"
                value={projection.businessId ?? ""}
              />
              <input
                type="hidden"
                name="storeId"
                value={projection.storeId ?? ""}
              />
              <input
                type="hidden"
                name="receiptSearch"
                value={state.receiptSearch ?? ""}
              />
              <input
                type="hidden"
                name="refundHistorySearch"
                value={state.refundHistorySearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Exact receipt number for a cash-sale void
                <input
                  type="search"
                  name="voidReceiptSearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.voidReceiptSearch ?? ""}
                  placeholder="Enter the full receipt number"
                  className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                Find voidable cash sale
              </button>
            </form>
            {state.voidReceiptSearch &&
            !controls.posVoidHistorySales?.length ? (
              <p className="text-sm text-muted-foreground" role="status">
                No eligible completed cash receipt is available in this
                authorized store under the current register and close rules.
              </p>
            ) : null}
          </section>
          <ActionPanel
            title="Void a completed cash sale"
            description="Same-register manager correction only. Restores original lots and loyalty evidence, cancels cash tender evidence, and records a reason and audit/outbox event."
          >
            <FormGrid
              action={voidCompletedPosSaleAction}
              submit="Void completed sale"
            >
              <HiddenScope projection={projection} returnPath={path} />
              <SelectField
                label="Completed sale"
                name="saleId"
                options={voidSaleOptions}
              />
              <SelectField
                label="Original open register"
                name="registerSessionId"
                options={voidRegisterSessionOptions}
              />
              <SelectField
                label="Manager"
                name="employeeId"
                options={controls.employees ?? []}
              />
              <TextField label="Void reason" name="reason" required />
              <TextField
                label="Manager PIN"
                name="managerPin"
                type="password"
                inputMode="numeric"
                required
              />
            </FormGrid>
          </ActionPanel>

          <EvidenceTable rows={projection.rows} title="Recent receipts" />
        </>
      ) : null}
    </PlatformPage>
  );
}
