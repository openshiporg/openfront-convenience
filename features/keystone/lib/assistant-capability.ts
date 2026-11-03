import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";
import { clientSourceFromHeaders, internalIdentityHeaders, loopbackOrigin } from "./internal-origin";

export async function assistantCapabilityPrincipal(
  cookieHeader: string | null,
  fetchImpl: typeof fetch = globalThis.fetch,
  sourceHeaders?: { get(name: string): string | null } | null,
): Promise<string | null> {
  if (!cookieHeader) return null;
  // Self-call to this process: loopback with the end user's signed identity when the port is known.
  const loopback = loopbackOrigin();
  const origin = loopback ?? await getBaseUrl();
  const response = await fetchImpl(`${origin}/api/graphql`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      ...(loopback ? internalIdentityHeaders(clientSourceFromHeaders(sourceHeaders)) : {}),
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
  sourceHeaders?: { get(name: string): string | null } | null,
): Promise<boolean> {
  return Boolean(await assistantCapabilityPrincipal(cookieHeader, fetchImpl, sourceHeaders));
}
