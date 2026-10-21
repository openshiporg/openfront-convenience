import { createHmac } from "node:crypto";

const graphqlUrl = process.env.OPENFRONT_GRAPHQL_URL?.trim();
const apiToken = process.env.OPENFRONT_API_TOKEN?.trim();
const businessId = process.env.OUTBOX_BUSINESS_ID?.trim();
const sinkText = process.env.OUTBOX_SINK_URL?.trim();
const signingValue = process.env.OUTBOX_SIGNING_VALUE;
const workerId =
  process.env.OUTBOX_WORKER_ID?.trim() || `convenience-worker-${process.pid}`;
const runOnce = process.argv.includes("--once");

if (!graphqlUrl || !apiToken || !businessId || !sinkText || !signingValue) {
  throw new Error(
    "Outbox worker requires GraphQL URL, machine token, business ID, HTTPS sink URL, and signing value",
  );
}
if (signingValue.length < 32)
  throw new Error("Outbox signing value must be at least 32 characters");
const workerGraphqlUrl = graphqlUrl;
const workerApiToken = apiToken;
const workerBusinessId = businessId;
const workerSigningValue = signingValue;
const sinkUrl = new URL(sinkText);
if (
  sinkUrl.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(sinkUrl.hostname)
) {
  throw new Error("Outbox sink must use HTTPS outside loopback development");
}

let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});

type ClaimedEvent = {
  id: string;
  eventKey: string;
  topic: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  action: string;
  payload: unknown;
  payloadHash: string;
  totalAttempts: number;
  leaseToken: string;
};

async function graphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(workerGraphqlUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${workerApiToken}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(
      `GraphQL worker request failed with HTTP ${response.status}`,
    );
  const result = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (!result.data || result.errors?.length)
    throw new Error("GraphQL worker operation was rejected");
  return result.data;
}

async function claim(): Promise<ClaimedEvent[]> {
  const data = await graphql<{
    claimOutboxEvents: {
      leaseToken: string;
      events: Array<Omit<ClaimedEvent, "leaseToken">>;
    };
  }>(
    `
      mutation Claim($input: ClaimOutboxEventsInput!) {
        claimOutboxEvents(input: $input) {
          leaseToken
          events {
            id
            eventKey
            topic
            schemaVersion
            aggregateType
            aggregateId
            action
            payload
            payloadHash
            totalAttempts
          }
        }
      }
    `,
    { input: { businessId: workerBusinessId, workerId, limit: 25 } },
  );
  return data.claimOutboxEvents.events.map((event) => ({
    ...event,
    leaseToken: data.claimOutboxEvents.leaseToken,
  }));
}

async function complete(
  event: ClaimedEvent,
  outcome: "delivered" | "retry" | "dead_letter",
  error = "",
) {
  await graphql(
    `
      mutation Complete($input: CompleteOutboxEventInput!) {
        completeOutboxEvent(input: $input) {
          id
          status
        }
      }
    `,
    {
      input: {
        businessId: workerBusinessId,
        eventId: event.id,
        workerId,
        leaseToken: event.leaseToken,
        outcome,
        error: error.slice(0, 500),
        retryAfterSeconds: Math.min(
          3600,
          15 * 2 ** Math.min(event.totalAttempts, 8),
        ),
        idempotencyKey: `worker-${event.id}-${event.totalAttempts}`,
      },
    },
  );
}

async function heartbeat(
  status: "healthy" | "failed",
  details: Record<string, unknown>,
) {
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
        businessId: workerBusinessId,
        kind: "outbox",
        workerId,
        status,
        details,
      },
    },
  );
}

async function deliver(event: ClaimedEvent) {
  const body = JSON.stringify({
    eventKey: event.eventKey,
    topic: event.topic,
    schemaVersion: event.schemaVersion,
    aggregate: { type: event.aggregateType, id: event.aggregateId },
    action: event.action,
    payloadHash: event.payloadHash,
    payload: event.payload,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", workerSigningValue)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const response = await fetch(sinkUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-openfront-event-key": event.eventKey,
      "x-openfront-timestamp": timestamp,
      "x-openfront-signature": `v1=${signature}`,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Sink returned HTTP ${response.status}`);
}

async function cycle() {
  const events = await claim();
  let delivered = 0;
  let failed = 0;
  for (const event of events) {
    if (stopping) break;
    try {
      await deliver(event);
      await complete(event, "delivered");
      delivered += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Delivery failed";
      await complete(
        event,
        event.totalAttempts >= 8 ? "dead_letter" : "retry",
        message,
      );
      failed += 1;
    }
  }
  await heartbeat(failed ? "failed" : "healthy", {
    claimed: events.length,
    delivered,
    failed,
  });
  return events.length;
}

async function main() {
  while (!stopping) {
    try {
      const count = await cycle();
      if (runOnce) break;
      await new Promise((resolve) => setTimeout(resolve, count ? 250 : 2_500));
    } catch (error) {
      console.error(
        "Outbox control cycle failed",
        error instanceof Error
          ? error.message.slice(0, 200)
          : "unknown failure",
      );
      // A revoked credential or unreachable GraphQL control plane cannot write
      // its own heartbeat. Exit so the service supervisor records failure and
      // restarts instead of presenting a live but permanently idle process.
      process.exitCode = 1;
      break;
    }
  }
}

main().catch(() => {
  process.exitCode = 1;
});
