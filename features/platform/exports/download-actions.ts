"use server";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import type { ExportDownloadState } from "./download-state";

export async function downloadExportArtifactAction(
  _previous: ExportDownloadState,
  formData: FormData,
): Promise<ExportDownloadState> {
  const businessId = String(formData.get("businessId") ?? "").trim();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!businessId || !batchId)
    return {
      status: "error",
      message: "Choose an export batch.",
      artifact: null,
    };
  const response = await keystoneClient<{
    downloadExportArtifact: {
      filename: string;
      contentType: string;
      checksum: string;
      content: string;
    };
  }>(
    `
    query PlatformDownloadExport($input: DownloadExportArtifactInput!) {
      downloadExportArtifact(input: $input) { filename contentType checksum content }
    }
  `,
    { input: { businessId, batchId } },
  );
  if (!response.success) {
    return {
      status: "error",
      message: response.error || "Export download failed.",
      artifact: null,
    };
  }
  return {
    status: "ready",
    message: `Checksum verified: ${response.data.downloadExportArtifact.checksum}`,
    artifact: response.data.downloadExportArtifact,
  };
}
