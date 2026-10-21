"use server";

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import type { OnboardingActionState } from "./state";

export async function onboardConvenienceBusinessAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const standardTaxPercent = Number(formData.get("standardTaxPercent") ?? 0);
  if (
    !Number.isFinite(standardTaxPercent) ||
    standardTaxPercent < 0 ||
    standardTaxPercent > 100
  ) {
    return {
      message: "Standard tax must be between 0 and 100 percent.",
      success: false,
    };
  }

  const input = {
    businessName: String(formData.get("businessName") ?? ""),
    businessCode: String(formData.get("businessCode") ?? ""),
    storeName: String(formData.get("storeName") ?? ""),
    storeCode: String(formData.get("storeCode") ?? ""),
    timezone: String(formData.get("timezone") ?? "America/New_York"),
    currencyCode: String(formData.get("currencyCode") ?? "USD"),
    standardTaxBasisPoints: Math.round(standardTaxPercent * 100),
    fuelEnabled: formData.get("fuelEnabled") === "on",
    storefrontStatus: String(
      formData.get("storefrontStatus") ?? "published",
    ),
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
    return {
      message:
        response.error ||
        "Business setup failed. Review the form and try again.",
      success: false,
    };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
  return { message: null, success: true };
}
