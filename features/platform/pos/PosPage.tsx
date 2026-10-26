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
  FormGrid,
  HiddenScope,
  LookupForm,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import Link from "next/link";

import { DataTable, PanelGrid, SectionTitle, StatusText, Td, Th, Tr, formatMeasure } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";
import { DurableOfflineQueue } from "./DurableOfflineQueue";
import { FastCheckoutStation } from "./FastCheckoutStation";
import { ReceiptLookup } from "./ReceiptLookup";
import { RefundSalePicker } from "./RefundSalePicker";
import { DurableRegisterClose } from "./DurableRegisterClose";
import { DurableRetailForm } from "./DurableRetailForm";
import { registerCloseActorId } from "./register-close-actions";
import { zonedNowInput } from "../lib/form-values";

const path = "/dashboard/platform/pos";

function storeTime(value: string, timeZone: string | null | undefined): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
  try {
    return new Date(value).toLocaleString("en-US", { ...options, timeZone: timeZone || "UTC" });
  } catch {
    return new Date(value).toLocaleString("en-US", { ...options, timeZone: "UTC" });
  }
}

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
  const itemLookup = projection ? (
    <LookupForm
      action={path}
      keep={{ businessId: projection.businessId, storeId: projection.storeId, receiptSearch: state.receiptSearch, refundHistorySearch: state.refundHistorySearch, voidReceiptSearch: state.voidReceiptSearch, posCartSearch: state.posCartSearch }}
      name="posVariantSearch"
      label="Find an item"
      placeholder="Title or SKU"
      defaultValue={state.posVariantSearch}
      submit="Search items"
      empty={state.posVariantSearch && !controls.productVariants?.length ? "No matching items" : false}
    />
  ) : null;
  const basketLookup = projection ? (
    <LookupForm
      action={path}
      keep={{ businessId: projection.businessId, storeId: projection.storeId, receiptSearch: state.receiptSearch, refundHistorySearch: state.refundHistorySearch, voidReceiptSearch: state.voidReceiptSearch, posVariantSearch: state.posVariantSearch }}
      name="posCartSearch"
      label="Find a basket"
      placeholder="Full basket number"
      defaultValue={state.posCartSearch}
      submit="Find basket"
      empty={state.posCartSearch && !controls.posCartLookup?.length ? "No open or held basket with that number" : false}
    />
  ) : null;
  return (
    <PlatformPage title="POS & Cash" {...state} showMetrics={false}>
      {projection ? (
        <Workbench
          scope="pos"
          sections={[
            {
              id: "checkout",
              label: "Checkout",
              content: (
                <>
                  <FastCheckoutStation
                    businessId={projection.businessId!}
                    storeId={projection.storeId!}
                    carts={cartActionOptions}
                    registerSessions={controls.registerSessions ?? []}
                    employees={controls.employees ?? []}
                    variants={controls.productVariants ?? []}
                    currencyCode={projection.currencyCode ?? "USD"}
                  />
                  {itemLookup}
                </>
              ),
            },
            {
              id: "basket",
              label: "Basket and tender",
              count: cartActionOptions.length,
              content: (
                <>
                  <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                    {basketLookup}
                    {itemLookup}
                  </div>
                  <PanelGrid>
                    <ActionPanel title="1 · Start basket">
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
                        <SelectField
                          label="Loyalty account (optional)"
                          name="loyaltyAccountId"
                          options={controls.loyaltyAccounts ?? []}
                          required={false}
                        />
                      </FormGrid>
                    </ActionPanel>
                    <ActionPanel title="2 · Scan or add item">
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
                      <ActionPanel title="3 · Apply promotion">
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
                    <ActionPanel title="Apply loyalty points">
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
                    <ActionPanel title="4 · Tender and issue receipt">
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
                  </PanelGrid>
                </>
              ),
            },
            {
              id: "corrections",
              label: "Corrections",
              content: (
                <PanelGrid columns={3}>
                  <ActionPanel title="Change line quantity">
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
                  <ActionPanel title="Remove basket line">
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
                  <ActionPanel title="Hold, resume, or void basket">
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
                </PanelGrid>
              ),
            },
            {
              id: "till",
              label: "Till and shift",
              count: controls.registerSessions?.length ?? 0,
              content: (
                <PanelGrid columns={3}>
                  <ActionPanel title="Set my POS PIN">
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
                  <ActionPanel title="Clock in">
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
                        label="Starts at"
                        name="startsAt"
                        defaultValue={zonedNowInput(projection.timezone)}
                        required
                      />
                      <TextField
                        label="Ends at"
                        name="endsAt"
                        defaultValue={zonedNowInput(projection.timezone, 8 * 60)}
                        required
                      />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Open till">
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
                  <ActionPanel title="Paid in, paid out, safe drop">
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
                  <ActionPanel title="Count and close till">
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
                  <ActionPanel title="Close shift">
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
                </PanelGrid>
              ),
            },
            {
              id: "refunds",
              label: "Refunds and voids",
              content: (
                <>
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, receiptSearch: state.receiptSearch }}
                    name="refundHistorySearch"
                    label="Find a sale to refund"
                    placeholder="Full receipt number"
                    defaultValue={state.refundHistorySearch}
                    submit="Find sale"
                    empty={state.refundHistorySearch && !controls.refundSales?.length ? "No receipt with that number" : false}
                  />
                  <ActionPanel title="Refund and return one sale line">
                    <DurableRetailForm userId={closeActorId} businessId={projection.businessId ?? ""} storeId={projection.storeId ?? ""} purpose="refundPosSale" label="Complete refund">
                      <HiddenScope projection={projection} returnPath={path} />
                      <RefundSalePicker
                        sales={controls.refundSales ?? []}
                        lines={controls.refundSaleLines ?? []}
                        tenders={controls.refundTenders ?? []}
                        lineSale={controls.refundLineSale ?? []}
                        tenderSale={controls.refundTenderSale ?? []}
                      />
                      <TextField
                        label="First allocation (cents; set for split refund)"
                        name="refundAllocationCents"
                        type="number"
                        min="0"
                        step="1"
                      />
                      <TextField
                        label="Second allocation (cents)"
                        name="refundAllocationCents2"
                        type="number"
                        min="0"
                        step="1"
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
                      <details className="grid gap-3 rounded-md border border-dashed p-3 sm:col-span-2">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Card or wallet refund</summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <TextField
                            label="Provider refund reference"
                            name="providerRefundId"
                          />
                          <TextField
                            label="Provider refund approval code"
                            name="providerAuthority"
                            placeholder="v2=timestamp.signature"
                          />
                          <TextField
                            label="Second provider refund reference"
                            name="providerRefundId2"
                          />
                          <TextField
                            label="Second provider approval code"
                            name="providerAuthority2"
                            placeholder="v2=timestamp.signature"
                          />
                        </div>
                      </details>
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
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, receiptSearch: state.receiptSearch, refundHistorySearch: state.refundHistorySearch }}
                    name="voidReceiptSearch"
                    label="Find a cash sale to void"
                    placeholder="Full receipt number"
                    defaultValue={state.voidReceiptSearch}
                    submit="Find sale"
                    empty={state.voidReceiptSearch && !controls.posVoidHistorySales?.length ? "No voidable cash sale with that number" : false}
                  />
                  <ActionPanel title="Void a completed cash sale">
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
                </>
              ),
            },
            {
              id: "receipts",
              label: "Receipts",
              count: projection.rows.length,
              content: (
                <>
                  <ReceiptLookup
                    businessId={projection.businessId!}
                    storeId={projection.storeId!}
                    sales={controls.receiptLookupSales ?? []}
                    search={state.receiptSearch}
                  />
                  <section className="min-w-0" aria-label="Recent receipts">
                    <SectionTitle meta={projection.rows.length || undefined}>Recent receipts</SectionTitle>
                    {projection.rows.length ? (
                      <DataTable aria-label="Recent receipts">
                        <thead>
                          <tr>
                            <Th>Receipt</Th>
                            <Th priority={3}>Number</Th>
                            <Th priority={2}>Completed</Th>
                            <Th align="right">Total</Th>
                            <Th>Status</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {projection.rows.map((row) => (
                            <Tr key={row.id}>
                              <Td>
                                <Link href={`/dashboard/platform/sales/${row.id}`} className="inline-flex min-h-6 items-center font-mono text-[12px] font-medium hover:underline max-sm:min-h-10">
                                  {row.title}
                                </Link>
                              </Td>
                              <Td priority={3} className="font-mono text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{row.detail}</Td>
                              <Td priority={2} className="whitespace-nowrap text-muted-foreground">
                                {row.occurredAt ? <time dateTime={row.occurredAt}>{storeTime(row.occurredAt, projection.timezone)}</time> : "—"}
                              </Td>
                              <Td align="right" className="whitespace-nowrap">{row.metric ? formatMeasure(row.metric) : "—"}</Td>
                              <Td><StatusText status={row.status} /></Td>
                            </Tr>
                          ))}
                        </tbody>
                      </DataTable>
                    ) : (
                      <p className="py-2 text-sm text-muted-foreground">No receipts yet</p>
                    )}
                  </section>
                </>
              ),
            },
            Boolean(controls.offlineDevices?.length) && {
              id: "offline",
              label: "Offline queue",
              content: (
                <DurableOfflineQueue
                  businessId={projection.businessId!}
                  storeId={projection.storeId!}
                  devices={controls.offlineDevices ?? []}
                  carts={controls.carts ?? []}
                  cartLines={controls.cartLines ?? []}
                  variants={controls.productVariants ?? []}
                  employees={controls.employees ?? []}
                />
              ),
            },
          ]}
        />
      ) : null}
    </PlatformPage>
  );
}
