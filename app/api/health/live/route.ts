import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "live", service: "openfront-convenience" }, {
    status: 200,
    headers: { "cache-control": "no-store" },
  });
}
