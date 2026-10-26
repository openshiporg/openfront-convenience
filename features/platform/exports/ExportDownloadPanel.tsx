"use client";

import { useActionState, useEffect } from "react";

import type { PlatformOption } from "../lib/projection";
import { downloadExportArtifactAction } from "./download-actions";
import { initialExportDownloadState } from "./download-state";
import { buttonClass, inputClass, labelClass } from "../components/cv-ui";

export function ExportDownloadPanel({
  businessId,
  batches,
}: {
  businessId: string;
  batches: PlatformOption[];
}) {
  const [state, action, pending] = useActionState(
    downloadExportArtifactAction,
    initialExportDownloadState,
  );

  useEffect(() => {
    if (!state.artifact) return;
    const blob = new Blob([state.artifact.content], {
      type: state.artifact.contentType,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = state.artifact.filename;
    link.click();
    URL.revokeObjectURL(url);
  }, [state.artifact]);

  return (
    <form
      action={action}
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <input type="hidden" name="businessId" value={businessId} />
      <label className={labelClass}>
        Checksum-verified batch
        <select
          name="batchId"
          required
          defaultValue={batches.length === 1 ? batches[0].id : ""}
          className={inputClass}
        >
          <option value="">Choose a batch</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.label}
              {batch.detail ? ` · ${batch.detail}` : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending || !batches.length}
        className={buttonClass}
      >
        {pending ? "Verifying…" : "Verify & download CSV"}
      </button>
      {state.message ? (
        <p
          className={`text-xs sm:col-span-2 ${state.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
