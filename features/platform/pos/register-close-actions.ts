"use server";

import { revalidatePath } from "next/cache";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import {
  parseRegisterCloseIntent,
  type RegisterCloseIntent,
} from "@/features/keystone/lib/registerCloseIntent";

export async function registerCloseActorId(): Promise<string> {
  const response = await keystoneClient<{
    authenticatedItem: { id?: string } | null;
  }>(`
    query RegisterCloseActor { authenticatedItem { ... on User { id } } }
  `);
  return response.success &&
    typeof response.data.authenticatedItem?.id === "string"
    ? response.data.authenticatedItem.id
    : "";
}

// No redirect loses the owned command. The GraphQL resolver rechecks current
// principal/membership/key/purpose and the original scope BEFORE effects.
export async function submitRetainedRegisterClose(
  input: RegisterCloseIntent,
): Promise<void> {
  const command = parseRegisterCloseIntent(input);
  const response = await keystoneClient(
    `
    mutation RetainedRegisterClose($input: CloseRegisterSessionInput!) {
      closeRegisterSession(input: $input) { id status reference replayed }
    }
  `,
    { input: command },
  );
  if (!response.success)
    throw new Error("Original close is unconfirmed; retrieve or retry SAME");
  // Revalidation failure does not establish rollback or justify another key.
  revalidatePath("/dashboard/platform/pos");
  revalidatePath("/dashboard/platform/reconciliation");
}
export async function readRetainedRegisterClose(
  input: RegisterCloseIntent,
): Promise<unknown> {
  const command = parseRegisterCloseIntent(input);
  const response = await keystoneClient<{ posOperationOutcome: unknown }>(
    `
    query RetainedRegisterCloseOutcome($input: PosOperationOutcomeInput!) {
      posOperationOutcome(input: $input) { state retryable id status reference }
    }
  `,
    {
      input: {
        businessId: command.businessId,
        storeId: command.storeId,
        scope: "closeRegisterSession",
        idempotencyKey: command.idempotencyKey,
        command,
      },
    },
  );
  return response.success ? response.data.posOperationOutcome : null;
}
