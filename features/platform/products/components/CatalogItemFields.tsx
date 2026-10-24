import { EnumField, SelectField, TextField } from "../../components/PlatformPage";
import type { PlatformOption } from "../../lib/projection";

export type CatalogItemDefaults = {
  title?: string;
  handle?: string;
  description?: string;
  status?: string;
  regulatedSaleType?: string;
  minimumAge?: number | null;
  taxCategoryId?: string;
  variantTitle?: string;
  sku?: string;
  sellBy?: string;
  unitOfMeasure?: string;
  defaultPriceCents?: number | null;
  costCents?: number | null;
  trackInventory?: boolean;
  allowNegativeInventory?: boolean;
  preparedFood?: boolean;
  discountable?: boolean;
  returnable?: boolean;
};

const yesNo = (value: boolean | undefined, fallback: boolean) => String(value ?? fallback);

/**
 * The configureCatalogItem fields. The operation updates the product by handle
 * and the variant by SKU, so prefilled defaults make this an edit form.
 */
export function CatalogItemFields({
  defaults = {},
  taxCategories,
  priceBooks,
  withDescription = false,
  lockIdentity = false,
}: {
  defaults?: CatalogItemDefaults;
  taxCategories: PlatformOption[];
  priceBooks: PlatformOption[];
  withDescription?: boolean;
  /** Keep handle and SKU fixed (editing an existing variant). */
  lockIdentity?: boolean;
}) {
  return (
    <>
      <TextField label="Product title" name="title" defaultValue={defaults.title} required />
      {lockIdentity ? (
        <input type="hidden" name="handle" value={defaults.handle ?? ""} />
      ) : (
        <TextField label="Product handle" name="handle" defaultValue={defaults.handle} pattern="[a-z0-9][a-z0-9\-]*" required />
      )}
      {withDescription ? (
        <label className="grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-2">
          Description
          <textarea
            name="description"
            defaultValue={defaults.description}
            maxLength={4000}
            rows={3}
            className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          />
        </label>
      ) : null}
      <EnumField
        label="Status"
        name="status"
        defaultValue={defaults.status}
        values={[
          { value: "active", label: "Active" },
          { value: "draft", label: "Draft" },
          { value: "discontinued", label: "Discontinued" },
        ]}
      />
      <EnumField
        label="Restricted sale type"
        name="regulatedSaleType"
        defaultValue={defaults.regulatedSaleType}
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
        label="Minimum age (restricted only)"
        name="minimumAge"
        type="number"
        min="1"
        max="120"
        step="1"
        defaultValue={defaults.minimumAge ?? undefined}
      />
      <SelectField
        label="Tax category"
        name="taxCategoryId"
        options={taxCategories}
        defaultValue={defaults.taxCategoryId}
        required={false}
      />
      <TextField label="Add to category (name)" name="categoryName" />
      <TextField label="Category code" name="categoryCode" />
      <TextField label="Variant title" name="variantTitle" defaultValue={defaults.variantTitle} required />
      {lockIdentity ? (
        <input type="hidden" name="sku" value={defaults.sku ?? ""} />
      ) : (
        <TextField label="SKU" name="sku" defaultValue={defaults.sku} required />
      )}
      <EnumField
        label="Sell by"
        name="sellBy"
        defaultValue={defaults.sellBy}
        values={[
          { value: "unit", label: "Unit" },
          { value: "weight", label: "Weight" },
          { value: "volume", label: "Volume" },
        ]}
      />
      <EnumField
        label="Unit of measure"
        name="unitOfMeasure"
        defaultValue={defaults.unitOfMeasure}
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
      <TextField label="Default price" name="defaultPriceCents" defaultValue={defaults.defaultPriceCents ?? undefined} required />
      <TextField label="Reference cost" name="costCents" defaultValue={defaults.costCents ?? undefined} />
      <SelectField label="Publish to price book" name="priceBookId" options={priceBooks} required={false} />
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
        defaultValue={yesNo(defaults.trackInventory, true)}
        values={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />
      <EnumField
        label="Allow negative stock"
        name="allowNegativeInventory"
        defaultValue={yesNo(defaults.allowNegativeInventory, false)}
        values={[
          { value: "false", label: "No: block sales at zero" },
          { value: "true", label: "Yes: sell before stock is received" },
        ]}
      />
      <EnumField
        label="Prepared food"
        name="preparedFood"
        defaultValue={yesNo(defaults.preparedFood, false)}
        values={[
          { value: "false", label: "No" },
          { value: "true", label: "Yes" },
        ]}
      />
      <EnumField
        label="Discountable"
        name="discountable"
        defaultValue={yesNo(defaults.discountable, true)}
        values={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />
      <EnumField
        label="Returnable"
        name="returnable"
        defaultValue={yesNo(defaults.returnable, true)}
        values={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />
    </>
  );
}
