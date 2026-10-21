type RelationshipInput = {
  connect?: { id?: string | null } | null;
  disconnect?: boolean | null;
};

type ValidationHookArgs = {
  operation: string;
  resolvedData?: Record<string, unknown>;
  addValidationError(message: string): void;
};

export function requireRelationshipId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const connect = (value as RelationshipInput).connect;
  return connect?.id ?? null;
}

export function requiredRelationshipHooks(...fieldNames: string[]) {
  return {
    validateInput({ operation, resolvedData, addValidationError }: ValidationHookArgs) {
      for (const fieldName of fieldNames) {
        const value = resolvedData?.[fieldName] as RelationshipInput | undefined;
        if (operation === "create" && !requireRelationshipId(value)) {
          addValidationError(`${fieldName} is required`);
        }
        if (operation === "update" && value?.disconnect === true) {
          addValidationError(`${fieldName} cannot be disconnected`);
        }
        if (operation === "update" && value?.connect && !requireRelationshipId(value)) {
          addValidationError(`${fieldName} must connect a valid item`);
        }
      }
    },
  };
}

export function validateEffectiveInterval({
  startsAt,
  endsAt,
  addValidationError,
}: {
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
  addValidationError(message: string): void;
}) {
  if (startsAt && endsAt && new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
    addValidationError("Effective end time must be after the start time");
  }
}
