"use client";

import { useActionState, useEffect } from "react";

import type { PlatformOption } from "../lib/projection";
import { downloadExportArtifactAction } from "./download-actions";
import { initialExportDownloadState } from "./download-state";
import { buttonClass, inputClass, labelClass } from "../components/cv-ui";
import { PlatformSelect } from "../components/PlatformSelect";

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
        <PlatformSelect
          name="batchId"
          required
          defaultValue={batches.length === 1 ? batches[0].id : ""}
          placeholder="Choose a batch"
          options={batches.map((batch) => ({ value: batch.id, label: batch.detail ? `${batch.label} · ${batch.detail}` : batch.label }))}
          className="h-9 rounded-[4px] text-[13px] max-sm:h-11 max-sm:text-base"
        />
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
