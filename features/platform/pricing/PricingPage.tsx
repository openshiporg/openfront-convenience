import {
  configureCatalogItemAction,
  configurePromotionAction,
  configureStoreTaxRateAction,
  setRetailPriceAction,
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
  return (
    <PlatformPage
      title="Pricing"
      {...state}
    >
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
                  <EvidenceTable
                    rows={projection.rows}
                    timeZone={projection.timezone}
                    title="Effective price entries"
                  />
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
