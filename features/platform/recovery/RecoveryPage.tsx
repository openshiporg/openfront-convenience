import {
  recordOfflineReplayBatchAction,
  registerOfflineDeviceAction,
  replayOutboxEventAction,
  revokeMachineApiKeyAction,
  transitionOfflineDeviceAction,
} from "../actions";
import {
  ActionPanel,
  EnumField,
  EvidenceTable,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";
import { ApiKeyPanel } from "./ApiKeyPanel";

const path = "/dashboard/platform/recovery";

export async function RecoveryPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("recovery", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return <PlatformPage title="Recovery" description="Store devices, offline sales and failed deliveries." {...state}>
    {projection ? <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ApiKeyPanel projection={projection} />
        <ActionPanel title="Revoke machine key" description="Revocation is checked on every bearer-authenticated request and takes effect immediately.">
          <FormGrid action={revokeMachineApiKeyAction} submit="Revoke key">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Active key" name="apiKeyId" options={controls.apiKeys ?? []} />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Register offline device" description="Optionally binds a store-scoped API key. Device codes cannot be reused after revocation.">
          <FormGrid action={registerOfflineDeviceAction} submit="Register device">
            <HiddenScope projection={projection} returnPath={path} />
            <TextField label="Device name" name="name" required />
            <TextField label="Device code" name="deviceCode" required />
            <SelectField label="Store-scoped API key (optional)" name="apiKeyId" options={controls.apiKeys ?? []} required={false} />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Change device authorization" description="Revocation is terminal and also revokes the bound API key immediately.">
          <FormGrid action={transitionOfflineDeviceAction} submit="Change authorization">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Device" name="deviceId" options={controls.offlineDevices ?? []} />
            <EnumField label="Next state" name="nextStatus" values={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspend" }, { value: "revoked", label: "Revoke permanently" }]} />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Replay dead-letter delivery" description="Moves one exhausted event back to the signed worker queue while preserving its payload hash and attempt history.">
          <FormGrid action={replayOutboxEventAction} submit="Replay delivery">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Dead-letter event" name="eventId" options={controls.outboxEvents ?? []} />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Replay one queued operation" description="Executes the queued payload through the normal permission, idempotency, transaction, audit, and outbox contract. Production clients can submit up to 500 contiguous operations through GraphQL.">
          <FormGrid action={recordOfflineReplayBatchAction} submit="Replay queued operation">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Device" name="deviceId" options={controls.offlineDevices ?? []} />
            <TextField label="Batch number" name="batchNumber" required />
            <TextField label="Sequence" name="sequence" type="number" min="1" step="1" required />
            <EnumField label="Operation" name="operationType" values={[{ value: "createPosCart", label: "Create POS cart" }, { value: "addPosCartLine", label: "Add POS line" }, { value: "applyPromotionToCart", label: "Apply promotion" }, { value: "completePosSale", label: "Complete POS sale" }, { value: "recordCashMovement", label: "Record cash movement" }]} />
            <TextField label="Operation idempotency key" name="operationIdempotencyKey" required />
            <TextField label="Operation payload (JSON object)" name="payload" placeholder='{"cartId":"…","barcode":"…","quantity":"1"}' required />
          </FormGrid>
        </ActionPanel>
      </div>
      <EvidenceTable rows={projection.rows} title="Replay batches" />
    </> : null}
  </PlatformPage>;
}
