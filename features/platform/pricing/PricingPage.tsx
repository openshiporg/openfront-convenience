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
      description="Products, barcodes, prices, tax rates and promotions."
      {...state}
    >
      {projection ? (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <ActionPanel
              title="Create or update catalog item"
              description="SKU and product handle are stable tenant keys. Discontinued products/variants cannot return to draft or active; replacements need a new handle and SKU. The barcode field sets a primary identifier only—it does not manage aliases or retire old codes. Restricted-item age values record merchant policy; Openfront does not determine legal requirements."
            >
              <FormGrid
                action={configureCatalogItemAction}
                submit="Save catalog item"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <TextField label="Product title" name="title" required />
                <TextField label="Product handle" name="handle" required />
                <EnumField
                  label="Status"
                  name="status"
                  values={[
                    { value: "active", label: "Active" },
                    { value: "draft", label: "Draft" },
                    { value: "discontinued", label: "Discontinued" },
                  ]}
                />
                <EnumField
                  label="Restricted sale type"
                  name="regulatedSaleType"
                  values={[
                    { value: "none", label: "None" },
                    { value: "alcohol", label: "Alcohol" },
                    { value: "tobacco", label: "Tobacco / nicotine" },
                    { value: "lottery", label: "Lottery" },
                    { value: "otc_medicine", label: "OTC medicine" },
                    { value: "other", label: "Other" },
                  ]}
                />
                <TextField
                  label="Merchant minimum age (restricted only)"
                  name="minimumAge"
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                />
                <SelectField
                  label="Tax category"
                  name="taxCategoryId"
                  options={controls.taxCategories ?? []}
                  required={false}
                />
                <TextField
                  label="New category name (optional)"
                  name="categoryName"
                />
                <TextField label="New category code" name="categoryCode" />
                <TextField label="Variant title" name="variantTitle" required />
                <TextField label="SKU" name="sku" required />
                <EnumField
                  label="Sell by"
                  name="sellBy"
                  values={[
                    { value: "unit", label: "Unit" },
                    { value: "weight", label: "Weight" },
                    { value: "volume", label: "Volume" },
                  ]}
                />
                <EnumField
                  label="Unit of measure"
                  name="unitOfMeasure"
                  values={[
                    { value: "each", label: "Each" },
                    { value: "lb", label: "Pound" },
                    { value: "oz", label: "Ounce" },
                    { value: "kg", label: "Kilogram" },
                    { value: "g", label: "Gram" },
                    { value: "gal", label: "Gallon" },
                    { value: "l", label: "Liter" },
                    { value: "ml", label: "Milliliter" },
                  ]}
                />
                <TextField
                  label="Default price (cents)"
                  name="defaultPriceCents"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Reference cost (cents)"
                  name="costCents"
                  type="number"
                  min="0"
                  step="1"
                />
                <SelectField
                  label="Publish to price book"
                  name="priceBookId"
                  options={controls.priceBooks ?? []}
                  required={false}
                />
                <TextField label="Barcode" name="barcode" />
                <EnumField
                  label="Barcode format"
                  name="barcodeFormat"
                  values={[
                    { value: "", label: "No barcode" },
                    { value: "upc_a", label: "UPC-A" },
                    { value: "upc_e", label: "UPC-E" },
                    { value: "ean_13", label: "EAN-13" },
                    { value: "ean_8", label: "EAN-8" },
                    { value: "plu", label: "PLU" },
                    { value: "gs1_databar", label: "GS1 DataBar" },
                    { value: "internal", label: "Internal" },
                  ]}
                />
                <EnumField
                  label="Track inventory"
                  name="trackInventory"
                  values={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                />
                <EnumField
                  label="Prepared food"
                  name="preparedFood"
                  values={[
                    { value: "false", label: "No" },
                    { value: "true", label: "Yes" },
                  ]}
                />
                <EnumField
                  label="Discountable"
                  name="discountable"
                  values={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                />
                <EnumField
                  label="Returnable"
                  name="returnable"
                  values={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                />
              </FormGrid>
            </ActionPanel>
            <div className="space-y-4">
              <ActionPanel
                title="Set retail price"
                description="Ends an overlapping active quantity tier and creates a new effective entry."
              >
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
              <ActionPanel
                title="Configure store tax rate"
                description="Enter one merchant-verified, pre-combined tax rate per store and category. Separate jurisdiction components are not added by checkout; this is not tax advice or automated filing."
              >
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
                    label="Rate (basis points)"
                    name="rateBasisPoints"
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
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
              <ActionPanel
                title="Configure promotion"
                description="Creates one deterministic relational rule; POS eligibility and discount allocation remain inside the cart operation."
              >
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
                    label="Percentage (basis points)"
                    name="valueBasisPoints"
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
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
            </div>
          </div>
          <EvidenceTable
            rows={projection.rows}
            title="Effective price entries"
          />
        </>
      ) : null}
    </PlatformPage>
  );
}
