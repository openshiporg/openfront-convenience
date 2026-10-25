"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedRadio, inputClass, primaryButtonClass } from "../components/cv-ui";
import { useOnboardingApi } from "./hooks/useOnboardingApi";
import seed from "./lib/seed.json";

// "Sample store" fills the form from lib/seed.json, like E-commerce's Complete template;
// the owner reviews and submits it through the same checks as a blank form.
const SAMPLE_VALUES: Record<string, string> = seed.sampleForm;

interface OnboardingFormProps {
  onSuccess?: () => void;
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
];

function timezoneOptions(): string[] {
  try {
    const all = Intl.supportedValuesOf("timeZone");
    return [...COMMON_TIMEZONES, ...all.filter((zone) => !COMMON_TIMEZONES.includes(zone))];
  } catch {
    return COMMON_TIMEZONES;
  }
}

export function OnboardingForm({ onSuccess }: OnboardingFormProps = {}) {
  const { state, action, pending, idempotencyKey } = useOnboardingApi(onSuccess);
  const [template, setTemplate] = useState<"sample" | "blank">("blank");
  const values = state.attempt > 0 ? state.values : template === "sample" ? SAMPLE_VALUES : {};
  const value = (name: string, fallback = "") => values[name] ?? fallback;

  return (
    // Keyed by attempt so a failed submit re-renders with what was typed.
    <form key={`${state.attempt}-${template}`} action={action} className="space-y-6">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {state.attempt === 0 && (
        <div
          onChange={(event) => {
            const input = event.target as HTMLInputElement;
            if (input.name === "template") setTemplate(input.value === "sample" ? "sample" : "blank");
          }}
        >
          <SegmentedRadio
            label="Start from"
            name="template"
            defaultValue={template}
            options={[
              { value: "sample", label: "Sample store", tone: "ok" },
              { value: "blank", label: "Blank", tone: "muted" },
            ]}
          />
          {template === "sample" && (
            <p className="mt-2 text-xs text-muted-foreground">
              {seed.storefront.name}: sample business details and {seed.demoProducts.length} products. Review and change anything before you create the store.
            </p>
          )}
        </div>
      )}

      {state.message && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-foreground">
          Business
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              name="businessName"
              autoComplete="organization"
              defaultValue={value("businessName")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessCode">Business code</Label>
            <Input
              id="businessCode"
              name="businessCode"
              pattern="[a-z0-9][a-z0-9\-]{1,62}"
              title="Lowercase letters, numbers and dashes"
              placeholder="corner-market"
              defaultValue={value("businessCode")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={value("timezone", "America/New_York")}
              className={inputClass}
              required
            >
              {timezoneOptions().map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-6">
        <legend className="text-sm font-semibold text-foreground">
          First store
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="storeName">Store name</Label>
            <Input id="storeName" name="storeName" defaultValue={value("storeName")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storeCode">Store code</Label>
            <Input
              id="storeCode"
              name="storeCode"
              pattern="[a-z0-9][a-z0-9\-]{0,62}"
              title="Lowercase letters, numbers and dashes"
              placeholder="main"
              defaultValue={value("storeCode")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currencyCode">Currency</Label>
            <Input
              id="currencyCode"
              name="currencyCode"
              defaultValue={value("currencyCode", "USD")}
              maxLength={3}
              pattern="[A-Za-z]{3}"
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressLine1">Street address</Label>
            <Input id="addressLine1" name="addressLine1" autoComplete="address-line1" maxLength={120} defaultValue={value("addressLine1")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" autoComplete="address-level2" maxLength={80} defaultValue={value("city")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stateProvince">State</Label>
              <Input id="stateProvince" name="stateProvince" autoComplete="address-level1" maxLength={80} defaultValue={value("stateProvince")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" name="postalCode" autoComplete="postal-code" maxLength={24} defaultValue={value("postalCode")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={value("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="standardTaxPercent">Standard tax (%)</Label>
            <Input
              id="standardTaxPercent"
              name="standardTaxPercent"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              defaultValue={value("standardTaxPercent", "0")}
              inputMode="decimal"
              required
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Checkbox id="fuelEnabled" name="fuelEnabled" defaultChecked={value("fuelEnabled") === "on"} />
            <Label htmlFor="fuelEnabled" className="font-normal">
              This store sells fuel
            </Label>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Checkbox id="includeDemoCatalog" name="includeDemoCatalog" defaultChecked={value("includeDemoCatalog") === "on"} />
            <Label htmlFor="includeDemoCatalog" className="font-normal">
              Add {seed.demoProducts.length} sample products
            </Label>
          </div>
        </div>
      </fieldset>

      <SegmentedRadio
        label="Storefront"
        name="storefrontStatus"
        defaultValue={value("storefrontStatus", "draft")}
        options={[
          { value: "draft", label: "Draft", tone: "muted" },
          { value: "published", label: "Published", tone: "ok" },
        ]}
      />

      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full sm:w-auto`}>
        {pending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {pending ? "Creating store…" : "Create store"}
      </button>
    </form>
  );
}
