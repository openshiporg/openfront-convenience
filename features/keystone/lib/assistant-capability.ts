import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";

export async function assistantCapabilityPrincipal(
  cookieHeader: string | null,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string | null> {
  if (!cookieHeader) return null;
  const origin = await getBaseUrl();
  const response = await fetchImpl(`${origin}/api/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
    },
    body: JSON.stringify({
      query: `
        query AssistantCapability {
          assistantCapability
          authenticatedItem {
            ... on User { id }
          }
        }
      `,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    data?: {
      assistantCapability?: boolean;
      authenticatedItem?: { id?: unknown } | null;
    };
    errors?: unknown[];
  };
  const principalId = payload.data?.authenticatedItem?.id;
  return !payload.errors?.length &&
    payload.data?.assistantCapability === true &&
    typeof principalId === "string" &&
    principalId.length > 0
    ? principalId
    : null;
}

export async function hasAssistantCapability(
  cookieHeader: string | null,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  return Boolean(await assistantCapabilityPrincipal(cookieHeader, fetchImpl));
}
