"use client";

import { Loader2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedRadio, primaryButtonClass } from "../components/cv-ui";
import { useOnboardingApi } from "./hooks/useOnboardingApi";

interface OnboardingFormProps {
  onSuccess?: () => void;
}

export function OnboardingForm({ onSuccess }: OnboardingFormProps = {}) {
  const { state, action, pending, idempotencyKey } = useOnboardingApi(onSuccess);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

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
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="businessCode">Business code</Label>
            <Input
              id="businessCode"
              name="businessCode"
              pattern="[a-z0-9][a-z0-9-]{1,62}"
              placeholder="northside-markets"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              name="timezone"
              defaultValue="America/New_York"
              required
            />
          </div>
        </div>
      </fieldset>

      <SegmentedRadio
        label="Storefront"
        name="storefrontStatus"
        defaultValue="draft"
        options={[
          { value: "draft", label: "Draft", tone: "muted" },
          { value: "published", label: "Published", tone: "ok" },
        ]}
      />

      <fieldset className="space-y-4 border-t pt-6">
        <legend className="text-sm font-semibold text-foreground">
          First store
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="storeName">Store name</Label>
            <Input id="storeName" name="storeName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="storeCode">Store code</Label>
            <Input
              id="storeCode"
              name="storeCode"
              pattern="[a-z0-9][a-z0-9-]{0,62}"
              placeholder="main"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currencyCode">Currency</Label>
            <Input
              id="currencyCode"
              name="currencyCode"
              defaultValue="USD"
              maxLength={3}
              pattern="[A-Za-z]{3}"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="standardTaxPercent">Standard tax (%)</Label>
            <Input
              id="standardTaxPercent"
              name="standardTaxPercent"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue="0"
              inputMode="decimal"
              required
            />
          </div>
          <div className="flex items-center gap-3 self-end pb-2">
            <Checkbox id="fuelEnabled" name="fuelEnabled" />
            <Label htmlFor="fuelEnabled" className="font-normal">
              This store sells fuel
            </Label>
          </div>
        </div>
      </fieldset>

      {state.message && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full sm:w-auto`}>
        {pending && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {pending ? "Creating store…" : "Create store"}
      </button>
    </form>
  );
}
