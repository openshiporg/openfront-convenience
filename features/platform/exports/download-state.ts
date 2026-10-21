export type ExportDownloadState = {
  status: "idle" | "error" | "ready";
  message: string;
  artifact: {
    filename: string;
    contentType: string;
    checksum: string;
    content: string;
  } | null;
};

export const initialExportDownloadState: ExportDownloadState = {
  status: "idle",
  message: "",
  artifact: null,
};
