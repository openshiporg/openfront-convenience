import {
  employeeForBusiness,
  type PermissionKey,
  type Session,
} from "../access";

type ActorInput = {
  employeeId?: unknown;
  cashierId?: unknown;
};

/** Bind any client-claimed operational employee to the authenticated actor. */
export async function assertOperationActor({
  session,
  businessId,
  storeId,
  permission,
  scope,
  operationInput,
  lookupMachineActor,
}: {
  session: Session;
  businessId: string;
  storeId?: string | null;
  permission: PermissionKey;
  scope: string;
  operationInput: unknown;
  lookupMachineActor: (employeeId: string) => Promise<boolean>;
}): Promise<void> {
  const actorInput =
    operationInput &&
    typeof operationInput === "object" &&
    !Array.isArray(operationInput)
      ? (operationInput as ActorInput)
      : {};

  if (scope === "openEmployeeShift") return;

  let claimedActorId: string | null = null;
  if (scope === "createPosCart") {
    if (
      typeof actorInput.cashierId !== "string" ||
      !actorInput.cashierId.trim()
    ) {
      throw new Error("POS cart creation requires an explicit cashier ID");
    }
    // cashierId is the field persisted by createPosCart. Never substitute an
    // unrelated employeeId payload field for that actor claim.
    claimedActorId = actorInput.cashierId;
  } else if (
    ["recordCashMovement", "updatePosCartLine", "removePosCartLine"].includes(
      scope,
    )
  ) {
    if (
      typeof actorInput.employeeId !== "string" ||
      !actorInput.employeeId.trim()
    ) {
      throw new Error(`${scope} requires an explicit employee ID`);
    }
    claimedActorId = actorInput.employeeId;
  } else if (typeof actorInput.employeeId === "string") {
    claimedActorId = actorInput.employeeId;
  }

  if (!claimedActorId) return;
  if (session.apiKeyId) {
    if (!(await lookupMachineActor(claimedActorId))) {
      throw new Error(
        "Machine operations may attribute work only to the API key creator's active employee record",
      );
    }
    return;
  }

  const boundActor = employeeForBusiness(
    session,
    businessId,
    permission,
    storeId,
  );
  if (!boundActor || boundActor.id !== claimedActorId) {
    throw new Error(
      "Selected operational employee must match the authenticated employee session",
    );
  }
}
