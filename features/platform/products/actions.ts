"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const PRODUCT_PATH = /^\/dashboard\/platform\/products\/[a-z0-9]{10,40}$/;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const MAX_BYTES = 8 * 1024 * 1024;

function back(form: FormData, params: Record<string, string>): never {
  const path = PRODUCT_PATH.test(value(form, "returnPath")) ? value(form, "returnPath") : "/dashboard/platform/products";
  const query = new URLSearchParams(params);
  for (const key of ["businessId", "storeId"]) if (value(form, key)) query.set(key, value(form, key));
  revalidatePath(path);
  redirect(`${path}?${query.toString()}`);
}

/** Adds a photo to a product (E-commerce's ProductImage list, Keystone image storage). */
export async function addProductImageAction(form: FormData) {
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) back(form, { error: "Choose an image" });
  if (!IMAGE_TYPES.has(file.type)) back(form, { error: "Use a JPEG, PNG, WebP, GIF or AVIF image" });
  if (file.size > MAX_BYTES) back(form, { error: "Images must be 8 MB or smaller" });
  const response = await keystoneClient<{ createProductImage: { id: string } | null }>(
    `mutation PlatformAddProductImage($data: ProductImageCreateInput!) { createProductImage(data: $data) { id } }`,
    {
      data: {
        business: { connect: { id: value(form, "businessId") } },
        products: { connect: [{ id: value(form, "productId") }] },
        image: { upload: file },
        altText: value(form, "altText").slice(0, 200),
        order: Number(value(form, "order")) || 0,
      },
    },
  );
  if (!response.success || !response.data.createProductImage?.id) back(form, { error: "The image couldn't be uploaded" });
  back(form, { notice: "Image added" });
}

export async function removeProductImageAction(form: FormData) {
  const response = await keystoneClient<{ deleteProductImage: { id: string } | null }>(
    `mutation PlatformRemoveProductImage($id: ID!) { deleteProductImage(where: { id: $id }) { id } }`,
    { id: value(form, "imageId") },
  );
  if (!response.success) back(form, { error: "The image couldn't be removed" });
  back(form, { notice: "Image removed" });
}
