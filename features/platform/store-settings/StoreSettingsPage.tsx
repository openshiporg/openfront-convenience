import { StoreLogoField } from "./components/StoreLogoField";
import { STOREFRONT_DAYS } from "@/features/storefront/lib/storefront-settings";

import { configureBusinessBrandAction } from "../actions";
import {
  ActionPanel,
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  TextField,
} from "../components/PlatformPage";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/store-settings";

export async function StoreSettingsPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("store_settings", searchParams);
  const brand = state.projection?.brand ?? null;
  const store = brand?.store ?? null;

  return (
    <PlatformPage
      title="Store Settings"
      description="Store details, logo and storefront publishing."
      businessOnly
      {...state}
    >
      {state.projection ? (
        <ActionPanel
          title="Public storefront"
          description="Drafts stay private. Publishing shows these details on your storefront."
        >
          <FormGrid
            action={configureBusinessBrandAction}
            submit="Save storefront settings"
          >
            <HiddenScope projection={state.projection} returnPath={path} />
            <input type="hidden" name="brandMark" value={brand?.mark ?? ""} />
            <input type="hidden" name="storefrontMode" value="live" />
            <StoreLogoField initialIcon={brand?.logoIcon ?? ""} initialColor={brand?.logoColor ?? "0"} />
            <TextField
              label="Public name"
              name="brandName"
              defaultValue={brand?.name ?? ""}
              maxLength={80}
              required
            />
            <TextField
              label="Public tagline"
              name="brandTagline"
              defaultValue={brand?.tagline ?? ""}
              maxLength={160}
            />
            <EnumField
              label="Publication"
              name="storefrontStatus"
              defaultValue={brand?.storefrontStatus ?? "draft"}
              values={[
                { value: "draft", label: "Draft — private" },
                { value: "published", label: "Published — public" },
              ]}
            />
            <TextField
              label="Address"
              name="addressLine1"
              defaultValue={store?.addressLine1 ?? ""}
              maxLength={120}
            />
            <TextField
              label="Address line 2"
              name="addressLine2"
              defaultValue={store?.addressLine2 ?? ""}
              maxLength={120}
            />
            <TextField
              label="City"
              name="city"
              defaultValue={store?.city ?? ""}
              maxLength={80}
            />
            <TextField
              label="State or province"
              name="stateProvince"
              defaultValue={store?.stateProvince ?? ""}
              maxLength={80}
            />
            <TextField
              label="Postal code"
              name="postalCode"
              defaultValue={store?.postalCode ?? ""}
              maxLength={24}
            />
            <TextField
              label="Country code"
              name="countryCode"
              defaultValue={store?.countryCode ?? "US"}
              pattern="[A-Za-z]{2}"
              maxLength={2}
            />
            <TextField
              label="Public phone"
              name="phone"
              defaultValue={store?.phone ?? ""}
              maxLength={40}
            />
            <fieldset className="grid min-w-0 gap-3 border p-3 sm:col-span-2 sm:grid-cols-2">
              <legend className="px-1 text-xs font-medium text-muted-foreground">
                Public hours
              </legend>
              {STOREFRONT_DAYS.map((day) => (
                <TextField
                  key={day}
                  label={day[0].toUpperCase() + day.slice(1)}
                  name={`hours${day[0].toUpperCase()}${day.slice(1)}`}
                  defaultValue={store?.hours[day] ?? ""}
                  maxLength={40}
                />
              ))}
            </fieldset>
          </FormGrid>
        </ActionPanel>
      ) : null}
    </PlatformPage>
  );
}
