const graphqlUrl = process.env.OPENFRONT_GRAPHQL_URL?.trim();
const apiToken = process.env.OPENFRONT_API_TOKEN?.trim();
const workerId =
  process.env.ALERT_WORKER_ID?.trim() || `convenience-alerts-${process.pid}`;
const cashVarianceThresholdCents = Number(
  process.env.ALERT_CASH_VARIANCE_THRESHOLD_CENTS ?? "1000",
);
const fuelVarianceThresholdGallons =
  process.env.ALERT_FUEL_VARIANCE_THRESHOLD_GALLONS?.trim() || "5";
const expiryWindowDays = Number(process.env.ALERT_EXPIRY_WINDOW_DAYS ?? "7");

if (!graphqlUrl || !apiToken)
  throw new Error(
    "Alert worker requires GraphQL URL and a scoped machine token",
  );
if (
  !Number.isSafeInteger(cashVarianceThresholdCents) ||
  cashVarianceThresholdCents < 0
) {
  throw new Error(
    "Alert cash variance threshold must be a non-negative integer number of cents",
  );
}
if (!/^\d+(?:\.\d{1,4})?$/.test(fuelVarianceThresholdGallons)) {
  throw new Error(
    "Alert fuel variance threshold must be a non-negative quantity with at most four decimal places",
  );
}
if (
  !Number.isSafeInteger(expiryWindowDays) ||
  expiryWindowDays < 0 ||
  expiryWindowDays > 365
) {
  throw new Error("Alert expiry window must be an integer from 0 to 365 days");
}

async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch(graphqlUrl!, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  const result = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: unknown }>;
  };
  if (!response.ok || !result.data || result.errors?.length) {
    const detail = (result.errors ?? [])
      .map((error) =>
        typeof error.message === "string" ? error.message : "unknown error",
      )
      .join("; ")
      .slice(0, 500);
    throw new Error(
      `Alert worker GraphQL operation failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  return result.data;
}

let discoveredBusinessIds: string[] = [];

async function main() {
  const stores: Array<{ id: string; business: { id: string } | null }> = [];
  let cursor = "";
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const page = await graphql<{
      stores: Array<{ id: string; business: { id: string } | null }>;
    }>(
      cursor
        ? `
            query AlertStores($cursor: ID!) {
              stores(
                where: { status: { equals: active }, id: { gt: $cursor } }
                orderBy: [{ id: asc }]
                take: 100
              ) {
                id
                business { id }
              }
            }
          `
        : `
            query AlertStores {
              stores(
                where: { status: { equals: active } }
                orderBy: [{ id: asc }]
                take: 100
              ) {
                id
                business { id }
              }
            }
          `,
      cursor ? { cursor } : {},
    );
    stores.push(...page.stores);
    if (page.stores.length < 100) break;
    cursor = page.stores.at(-1)!.id;
  }
  if (stores.length >= 10_000)
    throw new Error("Alert worker store bound reached; shard the worker scope");
  discoveredBusinessIds = Array.from(
    new Set(
      stores.flatMap((store) =>
        store.business?.id ? [store.business.id] : [],
      ),
    ),
  );
  const storesByBusiness = new Map<string, number>();
  for (const store of stores) {
    if (!store.business) continue;
    storesByBusiness.set(
      store.business.id,
      (storesByBusiness.get(store.business.id) ?? 0) + 1,
    );
  }
  for (const [businessId, storesEvaluated] of storesByBusiness) {
    await graphql(
      `
        mutation Evaluate($input: EvaluateOperationalAlertsInput!) {
          evaluateOperationalAlerts(input: $input) {
            status
          }
        }
      `,
      {
        input: {
          businessId,
          cashVarianceThresholdCents,
          fuelVarianceThresholdGallons,
          expiryWindowDays,
          idempotencyKey: `alerts-${businessId}-${new Date().toISOString().slice(0, 16)}`,
        },
      },
    );
    await graphql(
      `
        mutation Heartbeat($input: RecordOperationalHeartbeatInput!) {
          recordOperationalHeartbeat(input: $input) {
            status
          }
        }
      `,
      {
        input: {
          businessId,
          kind: "alerts",
          workerId,
          status: "healthy",
          details: { storesEvaluated },
        },
      },
    );
  }
  console.log(
    JSON.stringify({ status: "healthy", storesEvaluated: stores.length }),
  );
}

main().catch(async (error) => {
  for (const businessId of discoveredBusinessIds) {
    try {
      await graphql(
        `
          mutation Heartbeat($input: RecordOperationalHeartbeatInput!) {
            recordOperationalHeartbeat(input: $input) {
              status
            }
          }
        `,
        {
          input: {
            businessId,
            kind: "alerts",
            workerId,
            status: "failed",
            details: { error: "evaluation_failed" },
          },
        },
      );
    } catch {
      // External monitoring still observes the non-zero cron exit.
    }
  }
  console.error(error instanceof Error ? error.message : "Alert worker failed");
  process.exitCode = 1;
});
