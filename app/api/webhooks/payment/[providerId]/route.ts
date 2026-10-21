import { NextResponse } from "next/server";

import { RequestBodyError, readBoundedRequestText } from "@/features/keystone/lib/bounded-request-body";
import { keystoneContext } from "@/features/keystone/context";
import { ingestPaymentWebhook } from "@/features/keystone/mutations/paymentWebhookOperations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  try {
    const { providerId } = await params;
    const rawBody = await readBoundedRequestText(request, 256 * 1024);
    const result = await ingestPaymentWebhook(keystoneContext, {
      paymentProviderId: providerId,
      rawBody,
      headers: request.headers,
    });
    return NextResponse.json(
      { accepted: true, eventId: result.id, status: result.status, replayed: result.replayed },
      { status: result.replayed ? 200 : 202 },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ accepted: false }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "";
    const rejected = /signature|timestamp|valid JSON|unsupported webhook|payment provider is invalid|active payment provider not found|does not accept webhooks/i.test(message);
    return NextResponse.json({ accepted: false }, { status: rejected ? 401 : 503 });
  }
}
