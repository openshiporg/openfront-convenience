import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { configureCatalogItemAction, setRetailPriceAction } from "../../actions";
import { BandRow, DetailSection, FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, FormGrid, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { ListBand, pillClass, statusLabel, trackClass } from "../../components/cv-ui";
import { zonedNowInput } from "../../lib/form-values";
import { quantityText } from "../../lib/labels";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
import { CatalogItemFields } from "../components/CatalogItemFields";

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
  barcodes: Array<{ id: string; value: string; format: string; isPrimary: boolean; status: string }>;
  priceEntries: Array<{ id: string; amountCents: number; minQuantity: string; startsAt: string | null; endsAt: string | null; priceBook: { name: string } | null }>;
  stockLevels: Array<{ id: string; onHandQuantity: string; reorderPoint: string; location: { name: string } | null; store: { name: string } | null }>;
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
          id title sku status sellBy unitOfMeasure defaultPriceCents costCents trackInventory
          barcodes(orderBy: { value: asc }) { id value format isPrimary status }
          priceEntries(where: { status: { equals: active } }, orderBy: { startsAt: desc }, take: 10) { id amountCents minQuantity startsAt endsAt priceBook { name } }
          stockLevels { id onHandQuantity reorderPoint location { name } store { name } }
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

      <DetailSection title="Variants" meta={product.variants.length}>
        <ListBand>
          {product.variants.map((variant) => (
            <Link
              key={variant.id}
              href={`${path}${scopeQuery(scope, { variant: variant.id })}`}
              aria-current={variant.id === selectedVariant?.id ? "true" : undefined}
              className="block bg-background/60 hover:bg-background aria-[current=true]:bg-background aria-[current=true]:shadow-[inset_3px_0_0_var(--color-foreground)]"
            >
              <BandRow
                title={`${variant.title} · ${variant.sku}`}
                status={variant.status}
                meta={[
                  variant.barcodes.map((barcode) => barcode.value).join(", ") || "No barcode",
                  variant.trackInventory ? `${quantityText(onHand(variant).toFixed(4))} ${variant.unitOfMeasure} on hand` : "Not stock-tracked",
                  variant.costCents != null ? `cost ${money(variant.costCents)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                figure={money(variant.defaultPriceCents)}
              />
            </Link>
          ))}
        </ListBand>
      </DetailSection>

      {selectedVariant ? (
        <>
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <DetailSection title="Prices" meta={selectedVariant.priceEntries.length || undefined}>
              {selectedVariant.priceEntries.length ? (
                <ListBand>
                  {selectedVariant.priceEntries.map((entry) => (
                    <BandRow
                      key={entry.id}
                      title={entry.priceBook?.name ?? "Price book"}
                      meta={`From ${formatWhen(entry.startsAt, scope.timezone)}${entry.endsAt ? ` to ${formatWhen(entry.endsAt, scope.timezone)}` : ""} · min ${quantityText(entry.minQuantity)}`}
                      figure={money(entry.amountCents)}
                    />
                  ))}
                </ListBand>
              ) : (
                <p className="text-sm text-muted-foreground">Default price only</p>
              )}
            </DetailSection>
            <DetailSection title="Stock by location">
              {selectedVariant.stockLevels.length ? (
                <ListBand>
                  {selectedVariant.stockLevels.map((level) => (
                    <BandRow
                      key={level.id}
                      title={level.location?.name ?? "Location"}
                      state={Number(level.onHandQuantity) <= Number(level.reorderPoint) ? { tone: "warn", label: "Low" } : null}
                      meta={`${level.store?.name ?? ""} · reorder at ${quantityText(level.reorderPoint)}`}
                      figure={quantityText(level.onHandQuantity)}
                    />
                  ))}
                </ListBand>
              ) : (
                <p className="text-sm text-muted-foreground">No stock recorded</p>
              )}
            </DetailSection>
            <DetailSection title="Lots" meta={selectedVariant.lots.length || undefined}>
              {selectedVariant.lots.length ? (
                <ListBand>
                  {selectedVariant.lots.map((lot) => (
                    <BandRow
                      key={lot.id}
                      title={lot.lotNumber}
                      meta={`${lot.location?.name ?? ""} · expires ${lot.expiresAt ? formatWhen(lot.expiresAt, scope.timezone) : "never"}`}
                      figure={quantityText(lot.quantityRemaining)}
                    />
                  ))}
                </ListBand>
              ) : (
                <p className="text-sm text-muted-foreground">No open lots</p>
              )}
            </DetailSection>
            <DetailSection title="Vendors" meta={selectedVariant.vendorItems.length || undefined}>
              {selectedVariant.vendorItems.length ? (
                <ListBand>
                  {selectedVariant.vendorItems.map((item) => (
                    <Link key={item.id} href={`/dashboard/platform/vendors/${item.vendor?.id ?? ""}${scopeQuery(scope)}`} className="block hover:bg-background">
                      <BandRow
                        title={item.vendor?.name ?? "Vendor"}
                        meta={`${item.vendorSku}${item.casePackQuantity ? ` · case of ${item.casePackQuantity}` : ""}`}
                        figure={money(item.unitCostCents)}
                      />
                    </Link>
                  ))}
                </ListBand>
              ) : (
                <p className="text-sm text-muted-foreground">No vendor items</p>
              )}
            </DetailSection>
          </div>

          <ActionPanel title={`Edit ${selectedVariant.title}`}>
            <FormGrid action={configureCatalogItemAction} submit="Save">
              <HiddenScope projection={scope} returnPath={path} />
              <CatalogItemFields
                defaults={variantDefaults(selectedVariant)}
                taxCategories={taxOptions}
                priceBooks={bookOptions}
                withDescription
                lockIdentity
              />
            </FormGrid>
          </ActionPanel>
        </>
      ) : null}

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

      <DetailSection title="Recent stock movements" meta={inventoryLedgerEntries.length || undefined}>
        {inventoryLedgerEntries.length ? (
          <ListBand>
            {inventoryLedgerEntries.map((entry) => (
              <BandRow
                key={entry.id}
                title={`${statusLabel(entry.type)} · ${entry.variant?.sku ?? ""}`}
                meta={`${entry.location?.name ?? ""} · ${formatWhen(entry.occurredAt, scope.timezone)}${entry.reason ? ` · ${entry.reason}` : ""}`}
                figure={`${Number(entry.quantityDelta) > 0 ? "+" : ""}${quantityText(entry.quantityDelta)} → ${quantityText(entry.balanceAfter)}`}
              />
            ))}
          </ListBand>
        ) : (
          <p className="text-sm text-muted-foreground">No movements</p>
        )}
      </DetailSection>

      <div className={trackClass}>
        <Link className={pillClass} href={`/dashboard/platform/pricing${scopeQuery(scope)}`}>
          Pricing
        </Link>
        <Link className={pillClass} href={`/dashboard/platform/inventory${scopeQuery(scope)}`}>
          Count or adjust
        </Link>
        <Link className={pillClass} href={`/dashboard/platform/purchasing${scopeQuery(scope)}`}>
          Order more
        </Link>
      </div>
    </PlatformDetailShell>
  );
}
