"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

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
  await keystoneClient("mutation { endSession }");
  const jar = await cookies();
  jar.delete("keystonejs-session");
  jar.delete("convenience-basket");
  jar.delete("convenience-basket-proof");
  redirect("/account/signin");
}
