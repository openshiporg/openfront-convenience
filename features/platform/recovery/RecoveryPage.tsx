import { randomUUID } from "node:crypto";

import {
  recordOfflineReplayBatchAction,
  registerOfflineDeviceAction,
  revokeMachineApiKeyAction,
  transitionOfflineDeviceAction,
} from "../actions";
import {
  ActionPanel,
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { DataTable, PanelGrid, SectionTitle, StatusText, Td, Th, Tr } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";
import { ApiKeyPanel } from "./ApiKeyPanel";
import { QueueSubmit } from "./QueueSubmit";

const BATCH_RANK: Record<string, number> = { rejected: 0, conflict: 1, partial: 3 };

const path = "/dashboard/platform/recovery";

export async function RecoveryPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("recovery", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  // What needs the manager: rejected and conflicting replay batches, then partial batches.
  const queue = projection
    ? [
        ...projection.rows
          .filter((row) => row.status in BATCH_RANK)
          .map((row) => ({ kind: "batch" as const, rank: BATCH_RANK[row.status], id: row.id, title: row.title, detail: row.detail, status: row.status })),
      ].sort((a, b) => a.rank - b.rank)
    : [];
  return <PlatformPage title="Recovery" {...state} showMetrics={false}>
    {projection ? (
      <section aria-labelledby="recovery-queue" className="min-w-0">
        <SectionTitle id="recovery-queue" meta={queue.length || undefined}>Needs you</SectionTitle>
        {queue.length ? (
          <DataTable aria-label="Recovery queue">
            <thead>
              <tr>
                <Th>Record</Th>
                <Th priority={2}>Kind</Th>
                <Th priority={2}>Detail</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <Tr key={`${item.kind}-${item.id}`}>
                  <Td className="font-mono text-[12px] [overflow-wrap:anywhere]">{item.title}</Td>
                  <Td priority={2} className="text-muted-foreground">Replay batch</Td>
                  <Td priority={2} className="text-muted-foreground [overflow-wrap:anywhere]">{item.detail || "—"}</Td>
                  <Td><StatusText status={item.status} /></Td>
                  <Td className="text-right">
                    <span className="text-[12px] text-muted-foreground">Offline replay below</span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">No rejected or conflicting batches</p>
        )}
      </section>
    ) : null}
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
                </PanelGrid>
                <section className="min-w-0" aria-label="Replay batches">
                  <SectionTitle meta={projection.rows.length || undefined}>Replay batches</SectionTitle>
                  {projection.rows.length ? (
                    <DataTable aria-label="Replay batches">
                      <thead>
                        <tr>
                          <Th>Batch</Th>
                          <Th priority={2}>Operations</Th>
                          <Th priority={3}>Received</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {projection.rows.map((row) => (
                          <Tr key={row.id}>
                            <Td className="font-mono text-[12px] [overflow-wrap:anywhere]">{row.title}</Td>
                            <Td priority={2} className="text-muted-foreground">{row.detail || "—"}</Td>
                            <Td priority={3} className="whitespace-nowrap text-muted-foreground">
                              {row.occurredAt ? <time dateTime={row.occurredAt}>{storeTime(row.occurredAt, projection.timezone)}</time> : "—"}
                            </Td>
                            <Td><StatusText status={row.status} /></Td>
                          </Tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : (
                    <p className="py-2 text-sm text-muted-foreground">Nothing recorded yet</p>
                  )}
                </section>
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

function storeTime(value: string, timeZone: string | null | undefined): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
  try {
    return new Date(value).toLocaleString("en-US", { ...options, timeZone: timeZone || "UTC" });
  } catch {
    return new Date(value).toLocaleString("en-US", { ...options, timeZone: "UTC" });
  }
}
