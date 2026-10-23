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
import { PanelGrid } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";
import { ApiKeyPanel } from "./ApiKeyPanel";

const path = "/dashboard/platform/recovery";

export async function RecoveryPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("recovery", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return <PlatformPage title="Recovery" {...state}>
    {projection ? (
      <Workbench
        scope="recovery"
        sections={[
          {
            id: "replay",
            label: "Offline replay",
            count: projection.rows.length,
            content: (
              <>
                <PanelGrid>
                  <ActionPanel title="Replay one queued operation">
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
                  <ActionPanel title="Replay dead-letter delivery">
                    <FormGrid action={replayOutboxEventAction} submit="Replay delivery">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Dead-letter event" name="eventId" options={controls.outboxEvents ?? []} />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
                <EvidenceTable rows={projection.rows} timeZone={projection.timezone} title="Replay batches" />
              </>
            ),
          },
          {
            id: "devices",
            label: "Devices",
            content: (
              <PanelGrid>
                <ActionPanel title="Register offline device">
                  <FormGrid action={registerOfflineDeviceAction} submit="Register device">
                    <HiddenScope projection={projection} returnPath={path} />
                    <TextField label="Device name" name="name" required />
                    <TextField label="Device code" name="deviceCode" required />
                    <SelectField label="Store-scoped API key (optional)" name="apiKeyId" options={controls.apiKeys ?? []} required={false} />
                  </FormGrid>
                </ActionPanel>
                <ActionPanel title="Change device authorization">
                  <FormGrid action={transitionOfflineDeviceAction} submit="Change authorization">
                    <HiddenScope projection={projection} returnPath={path} />
                    <SelectField label="Device" name="deviceId" options={controls.offlineDevices ?? []} />
                    <EnumField label="Next state" name="nextStatus" values={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspend" }, { value: "revoked", label: "Revoke permanently" }]} />
                  </FormGrid>
                </ActionPanel>
              </PanelGrid>
            ),
          },
          {
            id: "keys",
            label: "Machine keys",
            content: (
              <PanelGrid>
                <ApiKeyPanel projection={projection} />
                <ActionPanel title="Revoke machine key">
                  <FormGrid action={revokeMachineApiKeyAction} submit="Revoke key">
                    <HiddenScope projection={projection} returnPath={path} />
                    <SelectField label="Active key" name="apiKeyId" options={controls.apiKeys ?? []} />
                  </FormGrid>
                </ActionPanel>
              </PanelGrid>
            ),
          },
        ]}
      />
    ) : null}
  </PlatformPage>;
}
