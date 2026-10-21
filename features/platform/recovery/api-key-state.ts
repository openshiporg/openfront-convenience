export type ApiKeyCreationState = {
  status: "idle" | "success" | "error";
  token: string;
  reference: string;
  message: string;
};

export const initialApiKeyCreationState: ApiKeyCreationState = {
  status: "idle",
  token: "",
  reference: "",
  message: "",
};
