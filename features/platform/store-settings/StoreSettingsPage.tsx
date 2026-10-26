import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { STOREFRONT_DAYS } from "@/features/storefront/lib/storefront-settings";

import { configureBusinessBrandAction } from "../actions";
import { Dot, SectionTitle, SegmentedRadio, panelClass, wellClass } from "../components/cv-ui";
import {
  FormGrid,
  HiddenScope,
  PlatformPage,
  TextField,
} from "../components/PlatformPage";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";
import { StoreLogoField } from "./components/StoreLogoField";
import { StoreResources } from "./StoreResources";
import { DEFAULT_STORE_LOGO_ICON } from "./lib/store-logo";

const path = "/dashboard/platform/store-settings";

export async function StoreSettingsPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("store_settings", searchParams);
  const brand = state.projection?.brand ?? null;
  const store = brand?.store ?? null;

  const published = brand?.storefrontStatus === "published";
  const section = "grid min-w-0 gap-3 border-t pt-5 sm:col-span-2 sm:grid-cols-2";
  const heading = "text-[14px] font-semibold text-foreground sm:col-span-2";
  // Blank fields the storefront needs, first in the page so they are filled before anything else.
  const missing: Array<{ id: string; label: string }> = brand
    ? [
        !brand.name ? { id: "field-brandName", label: "Public name" } : null,
        !store?.addressLine1 ? { id: "field-addressLine1", label: "Address" } : null,
        !store?.city ? { id: "field-city", label: "City" } : null,
        !store?.postalCode ? { id: "field-postalCode", label: "Postal code" } : null,
        !store?.phone ? { id: "field-phone", label: "Phone" } : null,
        STOREFRONT_DAYS.every((day) => !store?.hours[day]) ? { id: `field-hours-${STOREFRONT_DAYS[0]}`, label: "Opening hours" } : null,
      ].filter((entry): entry is { id: string; label: string } => Boolean(entry))
    : [];

  return (
    <PlatformPage
      title="Store Settings"
      businessOnly
      showMetrics={false}
      state={brand ? { tone: published ? "ok" : "muted", label: published ? "Storefront published" : "Storefront draft" } : null}
      {...state}
    >
      {state.projection && missing.length ? (
        <section aria-labelledby="settings-missing" className="min-w-0">
          <SectionTitle id="settings-missing" meta={missing.length}>Blank fields</SectionTitle>
          <ul className="flex min-w-0 flex-wrap gap-x-1 gap-y-1">
            {missing.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className="inline-flex min-h-9 items-baseline gap-1.5 rounded-[4px] border px-3 py-2 text-[13px] font-medium text-foreground hover:bg-muted max-sm:min-h-10"
                >
                  <Dot tone="warn" />
                  {entry.label}
                  <span className="text-muted-foreground">blank</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {state.projection ? (
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className={panelClass} aria-label="Storefront settings">
            <FormGrid action={configureBusinessBrandAction} submit="Save">
              <HiddenScope projection={state.projection} returnPath={path} />
              <input type="hidden" name="brandMark" value={brand?.mark ?? ""} />
              <input type="hidden" name="storefrontMode" value="live" />
              <h2 className={heading}>Brand</h2>
              <StoreLogoField initialIcon={brand?.logoIcon ?? ""} initialColor={brand?.logoColor ?? "0"} />
              <TextField label="Public name" id="field-brandName" name="brandName" defaultValue={brand?.name ?? ""} maxLength={80} required />
              <TextField label="Tagline" name="brandTagline" defaultValue={brand?.tagline ?? ""} maxLength={160} />
              <div className="sm:col-span-2">
                <SegmentedRadio
                  label="Storefront"
                  name="storefrontStatus"
                  defaultValue={brand?.storefrontStatus ?? "draft"}
                  options={[
                    { value: "draft", label: "Draft", tone: "muted" },
                    { value: "published", label: "Published", tone: "ok" },
                  ]}
                />
              </div>
              <div className={section}>
                <h2 className={heading}>Location</h2>
                <TextField label="Address" id="field-addressLine1" name="addressLine1" defaultValue={store?.addressLine1 ?? ""} maxLength={120} />
                <TextField label="Address line 2" name="addressLine2" defaultValue={store?.addressLine2 ?? ""} maxLength={120} />
                <TextField label="City" id="field-city" name="city" defaultValue={store?.city ?? ""} maxLength={80} />
                <TextField label="State or province" name="stateProvince" defaultValue={store?.stateProvince ?? ""} maxLength={80} />
                <TextField label="Postal code" id="field-postalCode" name="postalCode" defaultValue={store?.postalCode ?? ""} maxLength={24} />
                <TextField
                  label="Country code"
                  name="countryCode"
                  defaultValue={store?.countryCode ?? "US"}
                  pattern="[A-Za-z]{2}"
                  maxLength={2}
                  className="font-mono uppercase"
                />
                <TextField label="Phone" id="field-phone" name="phone" type="tel" defaultValue={store?.phone ?? ""} maxLength={40} />
              </div>
              <div className={section}>
                <h2 className={heading}>Hours</h2>
                {STOREFRONT_DAYS.map((day) => (
                  <TextField
                    key={day}
                    id={`field-hours-${day}`}
                    label={day[0].toUpperCase() + day.slice(1)}
                    name={`hours${day[0].toUpperCase()}${day.slice(1)}`}
                    defaultValue={store?.hours[day] ?? ""}
                    maxLength={40}
                    placeholder="e.g. 6am – 11pm, or Closed"
                    className="font-mono placeholder:font-sans"
                  />
                ))}
              </div>
            </FormGrid>
          </section>
          <aside className={`${wellClass} xl:sticky xl:top-4`} aria-label="Storefront preview">
            <div className="rounded-md border bg-background p-4">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="block h-10 w-9 shrink-0 [&>svg]:block [&>svg]:size-full"
                  style={{ filter: `hue-rotate(${brand?.logoColor ?? "0"}deg)` }}
                  dangerouslySetInnerHTML={{ __html: brand?.logoIcon || DEFAULT_STORE_LOGO_ICON }}
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold tracking-tight">{brand?.name || "Unnamed store"}</p>
                  {brand?.tagline ? <p className="truncate text-xs text-muted-foreground">{brand.tagline}</p> : null}
                </div>
              </div>
              {store ? (
                <p className="mt-4 border-t border-dashed pt-3 text-xs leading-5 text-muted-foreground">
                  {[store.addressLine1, store.city, store.stateProvince].filter(Boolean).join(", ") || "No address"}
                  {store.phone ? <><br /><span className="font-mono">{store.phone}</span></> : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span className="inline-flex items-baseline gap-1.5 text-xs text-muted-foreground">
                <Dot tone={published ? "ok" : "muted"} />
                {published ? "Published" : "Draft"}
              </span>
              {published ? (
                <Link href="/" target="_blank" className="inline-flex min-h-8 items-center gap-1 rounded-[4px] px-2 text-xs font-medium text-foreground hover:bg-background max-sm:min-h-10">
                  Open storefront
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
      {state.projection?.businessId && store ? (
        <StoreResources
          businessId={state.projection.businessId}
          storeId={store.id}
          storeName={store.name}
          timezone={state.projection.timezone}
          returnPath={path}
        />
      ) : null}
    </PlatformPage>
  );
}
