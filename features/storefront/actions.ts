"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { isCommonPassword } from "./lib/password-rules";
import { basket, catalog, history } from "./lib/data";
import { reorderable } from "./lib/reorder";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const basketMutation = `mutation Basket($input: StorefrontBasketInput!) { updateStorefrontBasket(input: $input) }`;
export async function changeBasket(form: FormData) {
  const jar = await cookies();
  const variantId = value(form, "variantId") || undefined;
  const lineId = value(form, "lineId") || undefined;
  const quantity = Number(value(form, "quantity") || "1");
  const existingCartId = jar.get("convenience-basket")?.value;
  let cartId = existingCartId ?? randomUUID();
  let token = jar.get("convenience-basket-proof")?.value ?? randomBytes(32).toString("hex");
  let result = await keystoneClient<{ updateStorefrontBasket: { id: string } | null }>(basketMutation, { input: { cartId, token, variantId, lineId, quantity, claim: true } });
  if ((!result.success || !result.data.updateStorefrontBasket?.id) && existingCartId && variantId && !lineId) {
    // The stored basket expired or belongs to another session: start a fresh one, as E-commerce does.
    cartId = randomUUID();
    token = randomBytes(32).toString("hex");
    result = await keystoneClient<{ updateStorefrontBasket: { id: string } | null }>(basketMutation, { input: { cartId, token, variantId, quantity, claim: true } });
  }
  if (!result.success || !result.data.updateStorefrontBasket?.id) redirect("/basket?error=basket");
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 86400 };
  jar.set("convenience-basket", cartId, options);jar.set("convenience-basket-proof", token, options);
  revalidatePath("/basket");redirect("/basket");
}
export async function customerAuth(form: FormData) {
  const mode = value(form, "mode");
  const email = value(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  if (mode === "signup") {
    if (isCommonPassword(password, email)) redirect("/account/signup?error=password");
    const result = await keystoneClient(`mutation Signup($data: UserCreateInput!) { createUser(data: $data) { id } }`, { data: { name: value(form, "name"), email, password } });
    if (!result.success) redirect("/account/signup?error=signup");
  }
  const result = await keystoneClient<{ authenticateUserWithPassword: { sessionToken?: string } }>(`mutation Login($email: String!, $password: String!) { authenticateUserWithPassword(email: $email, password: $password) { ... on UserAuthenticationWithPasswordSuccess { sessionToken } } }`, { email, password });
  const token = result.success ? result.data.authenticateUserWithPassword.sessionToken : null;
  if (!token) redirect("/account/signin?error=signin");
  (await cookies()).set("keystonejs-session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/account");
}
export async function customerSignout() {
  // Stateless cookies stay valid until they expire, so bump the user's session
  // version first: a copied cookie stops authenticating after sign-out.
  await keystoneClient("mutation { revokeCurrentUserSessions }");
  await keystoneClient("mutation { endSession }");
  const jar = await cookies();
  jar.delete("keystonejs-session");
  jar.delete("convenience-basket");
  jar.delete("convenience-basket-proof");
  redirect("/account/signin");
}

/** The list's quantity stepper: sets one item's quantity and stays on the page. */
export async function setBasketQuantity(form: FormData): Promise<{ ok: boolean }> {
  const jar = await cookies();
  const variantId = value(form, "variantId") || undefined;
  const lineId = value(form, "lineId") || undefined;
  const quantity = Math.max(0, Math.min(99, Number(value(form, "quantity") || "0") || 0));
  const existing = jar.get("convenience-basket")?.value;
  const proof = jar.get("convenience-basket-proof")?.value;
  if (!lineId && quantity === 0) return { ok: true };
  let cartId = existing ?? randomUUID();
  let token = proof ?? randomBytes(32).toString("hex");
  let result = await keystoneClient<{ updateStorefrontBasket: { id: string } | null }>(basketMutation, { input: { cartId, token, variantId: lineId ? undefined : variantId, lineId, quantity, claim: true } });
  if ((!result.success || !result.data.updateStorefrontBasket?.id) && existing && variantId && quantity > 0) {
    // The stored basket expired or belongs to another session: start a fresh one.
    cartId = randomUUID();
    token = randomBytes(32).toString("hex");
    result = await keystoneClient<{ updateStorefrontBasket: { id: string } | null }>(basketMutation, { input: { cartId, token, variantId, quantity, claim: true } });
  }
  if (!result.success || !result.data.updateStorefrontBasket?.id) return { ok: false };
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 86400 };
  jar.set("convenience-basket", cartId, options);
  jar.set("convenience-basket-proof", token, options);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Reorder last order": puts each item of the shopper's last receipt that the shop still sells online back in the basket. */
export async function reorderLast() {
  const [orders, data] = await Promise.all([history(), catalog({ page: 1 })]);
  const last = orders[0];
  if (!last || !data?.onlinePickup) redirect("/shop");
  for (const item of reorderable(last, data)) {
    const current = (await basket())?.lines.find((line) => line.titleSnapshot === item.title && line.variantTitleSnapshot === item.variantTitle);
    const form = new FormData();
    form.set("variantId", item.variantId);
    if (current) form.set("lineId", current.id);
    form.set("quantity", String(Math.min(99, (current ? Number(current.quantity) : 0) + item.quantity)));
    await setBasketQuantity(form);
  }
  redirect("/basket");
}
