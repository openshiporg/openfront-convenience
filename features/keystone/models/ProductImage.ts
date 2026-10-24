import { list } from "@keystone-6/core";
import { image, integer, relationship, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";

// E-commerce's ProductImage list (image in the S3 "my_images" storage, alt text,
// order, products), scoped to a business like every Convenience list. Photos are
// merchandising, not money or stock, so they're edited directly (see index.ts).
export const ProductImage = list({
  access: tenantAccess("canReadCatalog", "canManageCatalog", { delete: true }),
  ui: {
    listView: { initialColumns: ["image", "altText", "order", "products"] },
  },
  fields: {
    business: businessField(),
    image: image({ storage: "my_images" }),
    altText: text(),
    order: integer({ defaultValue: 0 }),
    products: relationship({ ref: "Product.images", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});
