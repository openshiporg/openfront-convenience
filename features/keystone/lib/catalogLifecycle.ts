export type ConfigurableProductStatus = "draft" | "active" | "discontinued";

export function assertCatalogLifecycleStatus(
  current: {
    productStatus?: string | null;
    variantStatus?: string | null;
  },
  requestedStatus: ConfigurableProductStatus,
): void {
  if (current.productStatus === "archived") {
    throw new Error(
      "Archived catalog products are terminal; create a new product identity",
    );
  }

  if (
    (current.productStatus === "discontinued" ||
      current.variantStatus === "discontinued") &&
    requestedStatus !== "discontinued"
  ) {
    throw new Error(
      "Discontinued catalog products and variants cannot return to draft or active; use a new product/SKU identity",
    );
  }
}
