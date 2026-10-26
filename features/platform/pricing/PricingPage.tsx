import {
  configureCatalogItemAction,
  configurePromotionAction,
  configureStoreTaxRateAction,
  setRetailPriceAction,
} from "../actions";
import {
  ActionPanel,
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { DataTable, PanelGrid, StatusText, Td, Th, Tr, formatMeasure } from "../components/cv-ui";
import { formatWhen } from "../lib/scope";
import { FormDisclosure, QueueSection, TableSection, monoCellClass } from "../stock/components/table-kit";
import { Workbench } from "../components/Workbench";
import { CatalogItemFields } from "../products/components/CatalogItemFields";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/pricing";

export async function PricingPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("pricing", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  // Projection rows are price entries: title is the item, detail is "Book · SKU".
  const entries = (projection?.rows ?? []).map((row) => {
    const [book, sku] = row.detail.split(" · ");
    return { ...row, book: book ?? "", sku: sku ?? "" };
  });
  const notLive = entries.filter((entry) => entry.status !== "active");
  const entryHead = (
    <>
      <Th priority={2}>SKU</Th>
      <Th>Item</Th>
      <Th priority={3}>Price book</Th>
      <Th align="right">Price</Th>
      <Th priority={3}>Updated</Th>
      <Th>Status</Th>
    </>
  );
  const entryRow = (entry: (typeof entries)[number]) => (
    <Tr key={entry.id}>
      <Td priority={2} className={monoCellClass}>
        {entry.sku || "—"}
      </Td>
      <Td className="[overflow-wrap:anywhere]">{entry.title}</Td>
      <Td priority={3} className="text-muted-foreground">
        {entry.book || "—"}
      </Td>
      <Td align="right">{formatMeasure(entry.metric)}</Td>
      <Td priority={3} className="whitespace-nowrap text-xs text-muted-foreground">
        {entry.occurredAt ? formatWhen(entry.occurredAt, projection?.timezone) : "—"}
      </Td>
      <Td>
        <StatusText status={entry.status} />
      </Td>
    </Tr>
  );
  return (
    <PlatformPage
      title="Pricing"
      {...state}
      showMetrics={false}
    >
      {projection && notLive.length ? (
        <QueueSection title="Not live" count={notLive.length} empty="">
          <DataTable>
            <thead>
              <tr>{entryHead}</tr>
            </thead>
            <tbody>{notLive.map(entryRow)}</tbody>
          </DataTable>
        </QueueSection>
      ) : null}
      {projection ? (
        <Workbench
          scope="pricing"
          sections={[
            {
              id: "prices",
              label: "Prices",
              count: projection.rows.length,
              content: (
                <>
                  <TableSection title="Price entries" count={entries.length} empty="No price entries yet" head={entryHead}>
                    {entries.map(entryRow)}
                  </TableSection>
                  <FormDisclosure summary="Set retail price" defaultOpen={!entries.length}>
                  <PanelGrid>
                    <ActionPanel title="Set retail price">
                      <FormGrid action={setRetailPriceAction} submit="Publish price">
                        <HiddenScope projection={projection} returnPath={path} />
                        <SelectField
                          label="Price book"
                          name="priceBookId"
                          options={controls.priceBooks ?? []}
                        />
                        <SelectField
                          label="Product variant"
                          name="variantId"
                          options={controls.productVariants ?? []}
                        />
                        <TextField
                          label="Amount (cents)"
                          name="amountCents"
                          type="number"
                          min="0"
                          step="1"
                          required
                        />
                        <TextField
                          label="Minimum quantity"
                          name="minQuantity"
                          inputMode="decimal"
                          defaultValue="1"
                        />
                        <TextField
                          label="Starts at (ISO + offset)"
                          name="startsAt"
                          required
                        />
                        <TextField label="Ends at (optional ISO)" name="endsAt" />
                      </FormGrid>
                    </ActionPanel>
                  </PanelGrid>
                  </FormDisclosure>
                </>
              ),
            },
            {
              id: "promotions",
              label: "Promotions",
              content: (
                <PanelGrid>
                  <ActionPanel title="Configure promotion">
                    <FormGrid
                      action={configurePromotionAction}
                      submit="Save promotion"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <TextField label="Promotion name" name="name" required />
                      <TextField label="Code (optional)" name="code" />
                      <EnumField
                        label="Status"
                        name="status"
                        values={[
                          { value: "draft", label: "Draft" },
                          { value: "scheduled", label: "Scheduled" },
                          { value: "active", label: "Active" },
                          { value: "paused", label: "Paused" },
                        ]}
                      />
                      <EnumField
                        label="Rule type"
                        name="ruleType"
                        values={[
                          { value: "item_discount", label: "Item discount" },
                          { value: "basket_discount", label: "Basket discount" },
                          { value: "quantity_break", label: "Quantity break" },
                        ]}
                      />
                      <EnumField
                        label="Benefit"
                        name="benefitMethod"
                        values={[
                          { value: "percentage", label: "Percentage" },
                          { value: "fixed_amount", label: "Fixed amount" },
                          { value: "fixed_price", label: "Fixed price" },
                          { value: "free_item", label: "Free item" },
                        ]}
                      />
                      <TextField
                        label="Percent off"
                        name="valuePercent"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                      <TextField
                        label="Fixed amount / price (cents)"
                        name="valueCents"
                        type="number"
                        min="0"
                        step="1"
                      />
                      <TextField
                        label="Minimum quantity"
                        name="minQuantity"
                        inputMode="decimal"
                      />
                      <TextField
                        label="Global redemption limit"
                        name="usageLimit"
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                      />
                      <TextField
                        label="Per-customer limit"
                        name="perCustomerLimit"
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                      />
                      <SelectField
                        label="Product target"
                        name="productId"
                        options={controls.products ?? []}
                        required={false}
                      />
                      <SelectField
                        label="Category target"
                        name="categoryId"
                        options={controls.productCategories ?? []}
                        required={false}
                      />
                      <TextField label="Starts at (ISO + offset)" name="startsAt" />
                      <TextField label="Ends at (ISO + offset)" name="endsAt" />
                      <EnumField
                        label="Stackable"
                        name="stackable"
                        values={[
                          { value: "false", label: "No" },
                          { value: "true", label: "Yes" },
                        ]}
                      />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              ),
            },
            {
              id: "items",
              label: "Catalog items",
              content: (
                <PanelGrid>
                  <ActionPanel title="Create or update catalog item">
                    <FormGrid
                      action={configureCatalogItemAction}
                      submit="Save catalog item"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <CatalogItemFields
                        taxCategories={controls.taxCategories ?? []}
                        priceBooks={controls.priceBooks ?? []}
                      />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              ),
            },
            {
              id: "tax",
              label: "Tax",
              content: (
                <PanelGrid>
                  <ActionPanel title="Configure store tax rate">
                    <FormGrid
                      action={configureStoreTaxRateAction}
                      submit="Save tax rate"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <TextField
                        label="Category name"
                        name="categoryName"
                        required
                      />
                      <TextField
                        label="Category code"
                        name="categoryCode"
                        required
                      />
                      <TextField label="Rate name" name="rateName" required />
                      <TextField
                        label="Composite jurisdiction label"
                        name="jurisdiction"
                        required
                      />
                      <TextField
                        label="Rate (%)"
                        name="ratePercent"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max="100"
                        step="0.0001"
                        required
                      />
                      <EnumField
                        label="Tax inclusive"
                        name="inclusive"
                        values={[
                          { value: "false", label: "No" },
                          { value: "true", label: "Yes" },
                        ]}
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
