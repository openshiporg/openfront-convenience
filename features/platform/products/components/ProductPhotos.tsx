import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { addProductImageAction, removeProductImageAction } from "../actions";
import { HiddenScope, TextField } from "../../components/PlatformPage";
import { DetailSection } from "../../components/PlatformDetailShell";
import { dangerButtonClass, inputClass, labelClass, panelClass, primaryButtonClass } from "../../components/cv-ui";

type Photo = { id: string; altText: string; order: number; image: { url: string; width: number; height: number } | null };

/** Product photos: shown on the storefront shelf tag and product page. */
export async function ProductPhotos({
  productId,
  productTitle,
  scope,
  returnPath,
}: {
  productId: string;
  productTitle: string;
  scope: { businessId: string | null; storeId: string | null; timezone: string | null };
  returnPath: string;
}) {
  const response = await keystoneClient<{ productImages: Photo[] }>(
    `query PlatformProductPhotos($id: ID!) {
      productImages(where: { products: { some: { id: { equals: $id } } } }, orderBy: { order: asc }, take: 12) {
        id altText order image { url width height }
      }
    }`,
    { id: productId },
  );
  const photos = response.success ? response.data.productImages : [];
  return (
    <DetailSection title="Photos" meta={photos.length || undefined}>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
        {photos.map((photo) => (
          <figure key={photo.id} className="min-w-0 overflow-hidden rounded-xl border bg-background">
            {photo.image?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed bucket URLs, shown as uploaded
              <img src={photo.image.url} alt={photo.altText || productTitle} className="aspect-square w-full object-contain bg-muted/30" loading="lazy" />
            ) : (
              <div className="grid aspect-square place-items-center bg-muted/40 text-xs text-muted-foreground">Unavailable</div>
            )}
            <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
              <span className="truncate text-xs text-muted-foreground">{photo.order === 0 ? "Main" : `#${photo.order}`}</span>
              <form action={removeProductImageAction}>
                <HiddenScope projection={scope} returnPath={returnPath} />
                <input type="hidden" name="imageId" value={photo.id} />
                <button type="submit" className={`${dangerButtonClass} min-h-8 px-3 text-xs`}>Remove</button>
              </form>
            </figcaption>
          </figure>
        ))}
      </div>
      <form action={addProductImageAction} className={`${panelClass} mt-3 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-end`}>
        <HiddenScope projection={scope} returnPath={returnPath} />
        <input type="hidden" name="productId" value={productId} />
        <label className={labelClass}>
          Photo
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" required className={`${inputClass} py-2 file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:text-xs`} />
        </label>
        <TextField label="Description (alt text)" name="altText" maxLength={200} />
        <TextField label="Order" name="order" type="number" min="0" step="1" defaultValue={photos.length} />
        <button type="submit" className={primaryButtonClass}>Upload</button>
      </form>
    </DetailSection>
  );
}
