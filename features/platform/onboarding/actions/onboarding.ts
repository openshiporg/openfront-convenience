"use server";

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

export type OnboardingStatus = "not_started" | "in_progress" | "completed" | "dismissed";

/**
 * Sidebar "Skip for now". Convenience has no updateActiveUser mutation, so this updates the
 * signed-in user directly; the User update filter and onboardingStatus field access decide who may.
 */
export async function dismissOnboarding() {
  const current = await keystoneClient<{
    authenticatedItem: { id: string; onboardingStatus: OnboardingStatus | null } | null;
  }>(`
    query DismissOnboardingUser {
      authenticatedItem {
        ... on User {
          id
          onboardingStatus
        }
      }
    }
  `);

  if (!current.success) return { success: false, error: current.error };

  const user = current.data.authenticatedItem;
  if (!user) return { success: false, error: "Sign in to dismiss onboarding." };
  if (user.onboardingStatus === "completed" || user.onboardingStatus === "dismissed") {
    return { success: true, data: user };
  }

  const response = await keystoneClient<{
    updateUser: { id: string; onboardingStatus: OnboardingStatus } | null;
  }>(
    `
      mutation DismissOnboarding($id: ID!) {
        updateUser(where: { id: $id }, data: { onboardingStatus: dismissed }) {
          id
          onboardingStatus
        }
      }
    `,
    { id: user.id },
  );

  if (!response.success) return { success: false, error: response.error };

  revalidatePath("/dashboard", "layout");
  return { success: true, data: response.data.updateUser };
}
