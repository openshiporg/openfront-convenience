"use server";

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import type { OnboardingActionState } from "./state";

const TEXT_FIELDS = [
  "businessName",
  "businessCode",
  "storeName",
  "storeCode",
  "timezone",
  "currencyCode",
  "standardTaxPercent",
  "storefrontStatus",
  "addressLine1",
  "city",
  "stateProvince",
  "postalCode",
  "phone",
] as const;

// The same rules the onboarding mutation enforces. The dashboard client hides
// server messages, so they are checked here and named to the operator.
function validate(values: Record<string, string>): string | null {
  if (!values.businessName || !values.storeName) return "Business and store names are required.";
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(values.businessCode))
    return "Business code must be 2–63 lowercase letters, numbers or dashes, such as corner-market.";
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(values.storeCode))
    return "Store code must be lowercase letters, numbers or dashes, such as main.";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: values.timezone || "America/New_York" });
  } catch {
    return "Choose a timezone from the list.";
  }
  if (!/^[A-Za-z]{3}$/.test(values.currencyCode || "USD")) return "Currency must be a three-letter code, such as USD.";
  const tax = Number(values.standardTaxPercent || 0);
  if (!Number.isFinite(tax) || tax < 0 || tax > 100) return "Standard tax must be between 0 and 100 percent.";
  return null;
}

export async function onboardConvenienceBusinessAction(
  previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const values: Record<string, string> = Object.fromEntries(
    TEXT_FIELDS.map((name) => [name, String(formData.get(name) ?? "").trim()]),
  );
  values.businessCode = values.businessCode.toLowerCase();
  values.storeCode = values.storeCode.toLowerCase();
  values.fuelEnabled = formData.get("fuelEnabled") === "on" ? "on" : "";
  values.includeDemoCatalog = formData.get("includeDemoCatalog") === "on" ? "on" : "";
  const attempt = previousState.attempt + 1;
  const failure = (message: string): OnboardingActionState => ({ message, success: false, values, attempt });

  const invalid = validate(values);
  if (invalid) return failure(invalid);

  const input = {
    businessName: values.businessName,
    businessCode: values.businessCode,
    storeName: values.storeName,
    storeCode: values.storeCode,
    timezone: values.timezone || "America/New_York",
    currencyCode: (values.currencyCode || "USD").toUpperCase(),
    standardTaxBasisPoints: Math.round(Number(values.standardTaxPercent || 0) * 100),
    fuelEnabled: values.fuelEnabled === "on",
    includeDemoCatalog: values.includeDemoCatalog === "on",
    storefrontStatus: values.storefrontStatus || "draft",
    addressLine1: values.addressLine1,
    city: values.city,
    stateProvince: values.stateProvince,
    postalCode: values.postalCode,
    phone: values.phone,
    idempotencyKey: String(formData.get("idempotencyKey") ?? ""),
  };

  const mutation = `
    mutation OnboardConvenienceBusiness($input: OnboardConvenienceBusinessInput!) {
      onboardConvenienceBusiness(input: $input) {
        id
        status
        replayed
        reference
      }
    }
  `;

  const response = await keystoneClient<{
    onboardConvenienceBusiness: {
      id: string;
      status: string;
      replayed: boolean;
      reference: string;
    };
  }>(mutation, { input });

  if (!response.success) {
    // Inputs passed the checks above, so the usual cause is a code already in use.
    return failure("The store couldn't be created. The business code may already be in use.");
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
  return { message: null, success: true, values: {}, attempt };
}
