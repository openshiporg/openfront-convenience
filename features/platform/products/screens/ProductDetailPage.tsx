import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { configureCatalogItemAction, setRetailPriceAction } from "../../actions";
import { FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, FormGrid, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { StatusText, Td, Th, Tr, buttonClass, statusLabel } from "../../components/cv-ui";
import { StockConditionText, stockCondition } from "../../stock/components/stock-queue";
import { FormDisclosure, StateText, TableSection, cellLinkClass, monoCellClass } from "../../stock/components/table-kit";
import { zonedNowInput } from "../../lib/form-values";
import { quantityText } from "../../lib/labels";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
import { CatalogItemFields } from "../components/CatalogItemFields";
import { ProductPhotos } from "../components/ProductPhotos";

type Variant = {
  id: string;
  title: string;
  sku: string;
  status: string;
  sellBy: string;
  unitOfMeasure: string;
  defaultPriceCents: number;
  costCents: number | null;
  trackInventory: boolean;
  allowNegativeInventory: boolean;
  barcodes: Array<{ id: string; value: string; format: string; isPrimary: boolean; status: string }>;
  priceEntries: Array<{ id: string; amountCents: number; minQuantity: string; startsAt: string | null; endsAt: string | null; priceBook: { name: string } | null }>;
  stockLevels: Array<{ id: string; onHandQuantity: string; reorderPoint: string; parQuantity: string; location: { name: string } | null; store: { name: string } | null }>;
  vendorItems: Array<{ id: string; vendorSku: string; unitCostCents: number; casePackQuantity: number | null; vendor: { id: string; name: string } | null }>;
  lots: Array<{ id: string; lotNumber: string; quantityRemaining: string; expiresAt: string | null; location: { name: string } | null }>;
};

type Product = {
  id: string;
  title: string;
  handle: string;
  status: string;
  regulatedSaleType: string;
  minimumAge: number | null;
  preparedFood: boolean;
  discountable: boolean;
  returnable: boolean;
  description: { document: unknown } | null;
  taxCategory: { id: string; name: string } | null;
  categories: Array<{ id: string; name: string }>;
  variants: Variant[];
};

function documentText(value: unknown): string {
  const lines: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (Array.isArray(record.children)) {
      const text = (record.children as Array<Record<string, unknown>>).map((child) => (typeof child.text === "string" ? child.text : "")).join("");
      if (record.type === "paragraph") return void lines.push(text);
      return (record.children as unknown[]).forEach(visit);
    }
  };
  visit(value);
  return lines.join("\n").trim();
}

export async function ProductDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PlatformSearch }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const scope = await getPlatformScope(search);
  const response = await keystoneClient<{
    product: Product | null;
    inventoryLedgerEntries: Array<{ id: string; type: string; quantityDelta: string; balanceAfter: string; occurredAt: string; reason: string; variant: { sku: string } | null; location: { name: string } | null }>;
    taxCategories: Array<{ id: string; name: string }>;
    priceBooks: Array<{ id: string; name: string }>;
  }>(
    `query PlatformProduct($id: ID!, $businessId: ID!, $storeId: ID!) {
      product(where: { id: $id }) {
        id title handle status regulatedSaleType minimumAge preparedFood discountable returnable
        taxCategory { id name }
        categories { id name }
        variants(orderBy: { sku: asc }) {
          id title sku status sellBy unitOfMeasure defaultPriceCents costCents trackInventory allowNegativeInventory
          barcodes(orderBy: { value: asc }) { id value format isPrimary status }
          priceEntries(where: { status: { equals: active } }, orderBy: { startsAt: desc }, take: 10) { id amountCents minQuantity startsAt endsAt priceBook { name } }
          stockLevels { id onHandQuantity reorderPoint parQuantity location { name } store { name } }
          vendorItems { id vendorSku unitCostCents casePackQuantity vendor { id name } }
          lots(where: { status: { equals: active } }, orderBy: { expiresAt: asc }, take: 10) { id lotNumber quantityRemaining expiresAt location { name } }
        }
      }
      inventoryLedgerEntries(where: { variant: { product: { id: { equals: $id } } } }, orderBy: { occurredAt: desc }, take: 15) {
        id type quantityDelta balanceAfter occurredAt reason variant { sku } location { name }
      }
      taxCategories(where: { business: { id: { equals: $businessId } } }, orderBy: { name: asc }) { id name }
      priceBooks(where: { stores: { some: { id: { equals: $storeId } } }, status: { equals: active } }, orderBy: { name: asc }) { id name }
    }`,
    { id, businessId: scope.businessId ?? "", storeId: scope.storeId ?? "" },
  );
  if (!response.success || !response.data.product) notFound();
  const { product, inventoryLedgerEntries, taxCategories, priceBooks } = response.data;
  // Separate so a description Keystone can't read (older seeded rows) never hides
  // the product; saving the edit form writes a valid document.
  const descriptionResponse = await keystoneClient<{ product: { description: { document: unknown } | null } | null }>(
    `query PlatformProductDescription($id: ID!) { product(where: { id: $id }) { description { document } } }`,
    { id },
  );
  product.description = descriptionResponse.success ? (descriptionResponse.data.product?.description ?? null) : null;
  // Unreadable descriptions (older seeded rows) are left out of the edit form so saving never blanks them.
  const descriptionReadable = descriptionResponse.success;
  const path = `/dashboard/platform/products/${product.id}`;
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, scope.currencyCode);
  const selectedVariant = product.variants.find((variant) => variant.id === searchValue(search, "variant")) ?? product.variants[0];
  const taxOptions = taxCategories.map((entry) => ({ id: entry.id, label: entry.name }));
  const bookOptions = priceBooks.map((entry) => ({ id: entry.id, label: entry.name }));
  const description = documentText(product.description?.document);
  const productDefaults = {
    title: product.title,
    handle: product.handle,
    description,
    status: product.status === "archived" ? "discontinued" : product.status,
    regulatedSaleType: product.regulatedSaleType,
    minimumAge: product.minimumAge,
    taxCategoryId: product.taxCategory?.id,
    preparedFood: product.preparedFood,
    discountable: product.discountable,
    returnable: product.returnable,
  };
  const variantDefaults = (variant: Variant) => ({
    ...productDefaults,
    variantTitle: variant.title,
    sku: variant.sku,
    sellBy: variant.sellBy,
    unitOfMeasure: variant.unitOfMeasure,
    defaultPriceCents: variant.defaultPriceCents,
    costCents: variant.costCents,
    trackInventory: variant.trackInventory,
    allowNegativeInventory: variant.allowNegativeInventory,
  });
  const onHand = (variant: Variant) => variant.stockLevels.reduce((sum, level) => sum + Number(level.onHandQuantity), 0);

  return (
    <PlatformDetailShell
      section="Products"
      sectionHref={`/dashboard/platform/products${scopeQuery(scope)}`}
      title={product.title}
      status={product.status}
      meta={[product.categories.map((category) => category.name).join(", ") || "No category", product.handle].join(" · ")}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        selectedVariant ? (
          <>
            <ActionPanel title="Publish a price">
              <FormGrid action={setRetailPriceAction} submit="Publish price">
                <HiddenScope projection={scope} returnPath={path} />
                <input type="hidden" name="variantId" value={selectedVariant.id} />
                <SelectField label="Price book" name="priceBookId" options={bookOptions} defaultValue={bookOptions[0]?.id} />
                <TextField label="Price" name="amountCents" defaultValue={selectedVariant.defaultPriceCents} required />
                <TextField label="Minimum quantity" name="minQuantity" inputMode="decimal" defaultValue="1" />
                <TextField label="Starts at" name="startsAt" defaultValue={zonedNowInput(scope.timezone)} required />
                <TextField label="Ends at (optional)" name="endsAt" />
              </FormGrid>
            </ActionPanel>
            {selectedVariant.status !== "discontinued" ? (
              <ActionPanel title="Discontinue variant" tone="danger">
                <FormGrid action={configureCatalogItemAction} submit="Discontinue">
                  <HiddenScope projection={scope} returnPath={path} />
                  {Object.entries({ ...variantDefaults(selectedVariant), status: "discontinued" }).map(([name, value]) =>
                    value === null || value === undefined || name === "description" ? null : (
                      <input
                        key={name}
                        type="hidden"
                        name={name}
                        value={name.endsWith("Cents") ? (Number(value) / 100).toFixed(2) : String(value)}
                      />
                    ),
                  )}
                </FormGrid>
              </ActionPanel>
            ) : null}
          </>
        ) : null
      }
    >
      <FactList
        facts={[
          ["Tax category", product.taxCategory?.name ?? "None"],
          ["Restricted", product.regulatedSaleType === "none" ? "No" : `${statusLabel(product.regulatedSaleType)} · ${product.minimumAge ?? "?"}+`],
          ["Prepared in store", product.preparedFood ? "Yes" : "No"],
          ["Discountable", product.discountable ? "Yes" : "No"],
          ["Returnable", product.returnable ? "Yes" : "No"],
          ["Variants", String(product.variants.length)],
        ]}
      />
      {description ? <p className="whitespace-pre-line text-sm text-muted-foreground">{description}</p> : null}

      <TableSection
        title="Variants"
        count={product.variants.length}
        empty="No variants"
        head={
          <>
            <Th>SKU</Th>
            <Th>Variant</Th>
            <Th priority={3}>Barcode</Th>
            <Th align="right" priority={2}>
              On hand
            </Th>
            <Th align="right" priority={3}>
              Cost
            </Th>
            <Th align="right">Price</Th>
            <Th>Status</Th>
          </>
        }
      >
        {product.variants.map((variant) => {
          const selected = variant.id === selectedVariant?.id;
          const total = onHand(variant);
          return (
            <Tr key={variant.id} className={selected ? "bg-muted/50" : undefined}>
              <Td className={monoCellClass}>{variant.sku}</Td>
              <Td>
                <Link
                  className={cellLinkClass}
                  href={`${path}${scopeQuery(scope, { variant: variant.id })}`}
                  aria-current={selected ? "true" : undefined}
                >
                  {variant.title}
                </Link>
                {selected ? <span className="ml-2 text-xs text-muted-foreground">Selected</span> : null}
              </Td>
              <Td priority={3} className={monoCellClass}>
                {variant.barcodes.map((barcode) => barcode.value).join(", ") || "—"}
              </Td>
              <Td align="right" priority={2} className={total < 0 ? "font-medium text-[oklch(0.52_0.19_27)] dark:text-red-400" : undefined}>
                {variant.trackInventory ? `${quantityText(total.toFixed(4))}` : "—"}
                {variant.trackInventory ? <span className="ml-1 font-sans text-xs text-muted-foreground">{variant.unitOfMeasure}</span> : null}
              </Td>
              <Td align="right" priority={3} className="text-muted-foreground">
                {variant.costCents != null ? money(variant.costCents) : "—"}
              </Td>
              <Td align="right">{money(variant.defaultPriceCents)}</Td>
              <Td>
                <StatusText status={variant.status} />
              </Td>
            </Tr>
          );
        })}
      </TableSection>

      {selectedVariant ? (
        <>
          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            <TableSection
              title={`Stock · ${selectedVariant.title}`}
              count={selectedVariant.stockLevels.length}
              empty={selectedVariant.trackInventory ? "No stock recorded" : "Not stock-tracked"}
              head={
                <>
                  <Th>Location</Th>
                  <Th align="right">On hand</Th>
                  <Th align="right" priority={2}>
                    Reorder at
                  </Th>
                  <Th align="right" priority={2}>
                    Par
                  </Th>
                  <Th>Status</Th>
                </>
              }
            >
              {selectedVariant.stockLevels.map((level) => {
                const condition = stockCondition(level);
                return (
                  <Tr key={level.id}>
                    <Td>
                      {level.location?.name ?? "Location"}
                      {level.store?.name ? <span className="ml-2 text-xs text-muted-foreground max-sm:hidden">{level.store.name}</span> : null}
                    </Td>
                    <Td align="right" className={condition === "negative" ? "font-medium text-[oklch(0.52_0.19_27)] dark:text-red-400" : undefined}>
                      {quantityText(level.onHandQuantity)}
                    </Td>
                    <Td align="right" priority={2} className="text-muted-foreground">
                      {quantityText(level.reorderPoint)}
                    </Td>
                    <Td align="right" priority={2} className="text-muted-foreground">
                      {Number(level.parQuantity) ? quantityText(level.parQuantity) : "—"}
                    </Td>
                    <Td>
                      <StockConditionText condition={condition} />
                    </Td>
                  </Tr>
                );
              })}
            </TableSection>
            <TableSection
              title="Lots"
              count={selectedVariant.lots.length}
              empty="No open lots"
              head={
                <>
                  <Th>Lot</Th>
                  <Th priority={2}>Location</Th>
                  <Th align="right">Remaining</Th>
                  <Th>Expires</Th>
                </>
              }
            >
              {selectedVariant.lots.map((lot) => {
                const expired = lot.expiresAt ? new Date(lot.expiresAt) < new Date() : false;
                return (
                  <Tr key={lot.id}>
                    <Td className={monoCellClass}>{lot.lotNumber}</Td>
                    <Td priority={2} className="text-muted-foreground">
                      {lot.location?.name ?? "—"}
                    </Td>
                    <Td align="right">{quantityText(lot.quantityRemaining)}</Td>
                    <Td className="whitespace-nowrap text-xs text-muted-foreground">
                      {expired ? <StateText tone="danger" label="Expired" /> : lot.expiresAt ? formatWhen(lot.expiresAt, scope.timezone) : "Never"}
                    </Td>
                  </Tr>
                );
              })}
            </TableSection>
            <TableSection
              title="Prices"
              count={selectedVariant.priceEntries.length}
              empty="Default price only"
              head={
                <>
                  <Th>Price book</Th>
                  <Th priority={2}>From</Th>
                  <Th priority={3}>To</Th>
                  <Th align="right" priority={3}>
                    Min qty
                  </Th>
                  <Th align="right">Price</Th>
                </>
              }
            >
              {selectedVariant.priceEntries.map((entry) => (
                <Tr key={entry.id}>
                  <Td>{entry.priceBook?.name ?? "Price book"}</Td>
                  <Td priority={2} className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatWhen(entry.startsAt, scope.timezone)}
                  </Td>
                  <Td priority={3} className="whitespace-nowrap text-xs text-muted-foreground">
                    {entry.endsAt ? formatWhen(entry.endsAt, scope.timezone) : "—"}
                  </Td>
                  <Td align="right" priority={3} className="text-muted-foreground">
                    {quantityText(entry.minQuantity)}
                  </Td>
                  <Td align="right">{money(entry.amountCents)}</Td>
                </Tr>
              ))}
            </TableSection>
            <TableSection
              title="Vendors"
              count={selectedVariant.vendorItems.length}
              empty="No vendor items"
              head={
                <>
                  <Th>Vendor</Th>
                  <Th priority={2}>Vendor SKU</Th>
                  <Th align="right" priority={3}>
                    Case
                  </Th>
                  <Th align="right">Unit cost</Th>
                </>
              }
            >
              {selectedVariant.vendorItems.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <Link className={cellLinkClass} href={`/dashboard/platform/vendors/${item.vendor?.id ?? ""}${scopeQuery(scope)}`}>
                      {item.vendor?.name ?? "Vendor"}
                    </Link>
                  </Td>
                  <Td priority={2} className={monoCellClass}>
                    {item.vendorSku}
                  </Td>
                  <Td align="right" priority={3} className="text-muted-foreground">
                    {item.casePackQuantity ?? "—"}
                  </Td>
                  <Td align="right">{money(item.unitCostCents)}</Td>
                </Tr>
              ))}
            </TableSection>
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            <Link className={buttonClass} href={`/dashboard/platform/inventory${scopeQuery(scope)}`}>
              Count or adjust
            </Link>
            <Link className={buttonClass} href={`/dashboard/platform/purchasing${scopeQuery(scope)}`}>
              Order more
            </Link>
            <Link className={buttonClass} href={`/dashboard/platform/pricing${scopeQuery(scope)}`}>
              Pricing
            </Link>
          </div>

          <ProductPhotos productId={product.id} productTitle={product.title} scope={scope} returnPath={path} />

          <FormDisclosure summary={`Edit ${selectedVariant.title}`}>
            <ActionPanel title={`Edit ${selectedVariant.title}`}>
              <FormGrid action={configureCatalogItemAction} submit="Save">
                <HiddenScope projection={scope} returnPath={path} />
                <CatalogItemFields
                  defaults={variantDefaults(selectedVariant)}
                  taxCategories={taxOptions}
                  priceBooks={bookOptions}
                  withDescription={descriptionReadable}
                  lockIdentity
                />
              </FormGrid>
            </ActionPanel>
          </FormDisclosure>
        </>
      ) : (
        <ProductPhotos productId={product.id} productTitle={product.title} scope={scope} returnPath={path} />
      )}

      <FormDisclosure summary="Add a variant">
        <ActionPanel title="Add a variant">
          <FormGrid action={configureCatalogItemAction} submit="Add variant">
            <HiddenScope projection={scope} returnPath={path} />
            <CatalogItemFields
              defaults={{ ...productDefaults, status: "active", trackInventory: true }}
              taxCategories={taxOptions}
              priceBooks={bookOptions}
            />
          </FormGrid>
        </ActionPanel>
      </FormDisclosure>

      <TableSection
        title="Recent stock movements"
        count={inventoryLedgerEntries.length}
        empty="No movements"
        head={
          <>
            <Th>When</Th>
            <Th>Type</Th>
            <Th priority={2}>SKU</Th>
            <Th priority={3}>Location</Th>
            <Th align="right">Change</Th>
            <Th align="right" priority={2}>
              Balance
            </Th>
          </>
        }
      >
        {inventoryLedgerEntries.map((entry) => (
          <Tr key={entry.id}>
            <Td className="whitespace-nowrap text-xs text-muted-foreground">{formatWhen(entry.occurredAt, scope.timezone)}</Td>
            <Td>
              {statusLabel(entry.type)}
              {entry.reason ? <span className="ml-2 text-xs text-muted-foreground max-sm:hidden">{entry.reason}</span> : null}
            </Td>
            <Td priority={2} className={monoCellClass}>
              {entry.variant?.sku ?? "—"}
            </Td>
            <Td priority={3} className="text-muted-foreground">
              {entry.location?.name ?? "—"}
            </Td>
            <Td align="right" className={Number(entry.quantityDelta) < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : undefined}>
              {`${Number(entry.quantityDelta) > 0 ? "+" : ""}${quantityText(entry.quantityDelta)}`}
            </Td>
            <Td align="right" priority={2} className={Number(entry.balanceAfter) < 0 ? "font-medium text-[oklch(0.52_0.19_27)] dark:text-red-400" : undefined}>
              {quantityText(entry.balanceAfter)}
            </Td>
          </Tr>
        ))}
      </TableSection>
    </PlatformDetailShell>
  );
}
