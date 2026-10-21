import {
  completePrepBatchAction,
  configurePreparedFoodRecipeAction,
  recordWasteAction,
  startPrepBatchAction,
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

const path = "/dashboard/platform/foodservice";

export async function FoodservicePage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("foodservice", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const recentVariantOptions = controls.productVariants ?? [];
  const searchedVariantOptions = state.foodserviceSkuSearch
    ? (controls.foodserviceVariantLookup ?? []).filter(
        (searched) =>
          !recentVariantOptions.some(
            (recent) => recent.id === searched.id,
          ),
      )
    : [];
  const variantSelectorOptions = [
    ...recentVariantOptions,
    ...searchedVariantOptions,
  ];
  const recentRecipeOptions = controls.recipes ?? [];
  const searchedRecipeOptions = state.recipeCodeSearch
    ? (controls.recipeLookup ?? []).filter(
        (searched) =>
          !recentRecipeOptions.some(
            (recent) => recent.id === searched.id,
          ),
      )
    : [];
  const recipeSelectorOptions = [
    ...recentRecipeOptions,
    ...searchedRecipeOptions,
  ];
  const recentLocationOptions = controls.inventoryLocations ?? [];
  const searchedLocationOptions = state.foodserviceLocationCodeSearch
    ? (controls.foodserviceLocationLookup ?? []).filter(
        (searched) =>
          !recentLocationOptions.some((recent) => recent.id === searched.id),
      )
    : [];
  const locationSelectorOptions = [
    ...recentLocationOptions,
    ...searchedLocationOptions,
  ];
  const recentOpenPrepBatchOptions = controls.openPrepBatches ?? [];
  const searchedOpenPrepBatchOptions = state.foodserviceBatchNumberSearch
    ? (controls.openPrepBatchLookup ?? []).filter(
        (searched) =>
          !recentOpenPrepBatchOptions.some((recent) => recent.id === searched.id),
      )
    : [];
  const openPrepBatchSelectorOptions = [
    ...recentOpenPrepBatchOptions,
    ...searchedOpenPrepBatchOptions,
  ];
  const recentPrepBatchOptions = controls.prepBatches ?? [];
  const searchedPrepBatchOptions = state.foodserviceBatchNumberSearch
    ? (controls.prepBatchLookup ?? []).filter(
        (searched) =>
          !recentPrepBatchOptions.some((recent) => recent.id === searched.id),
      )
    : [];
  const prepBatchSelectorOptions = [
    ...recentPrepBatchOptions,
    ...searchedPrepBatchOptions,
  ];
  const recentEmployeeOptions = controls.employees ?? [];
  const searchedEmployeeOptions = state.foodserviceEmployeeNumberSearch
    ? (controls.employeeLookup ?? []).filter(
        (searched) =>
          !recentEmployeeOptions.some((recent) => recent.id === searched.id),
      )
    : [];
  const employeeSelectorOptions = [
    ...recentEmployeeOptions,
    ...searchedEmployeeOptions,
  ];
  return <PlatformPage title="Foodservice" description="Prepared food batches and waste." {...state}>
    {projection ? <>
      <section
        aria-label="Find an exact recipe code"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Exact recipe code
            <input
              type="search"
              name="recipeCodeSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.recipeCodeSearch ?? ""}
              placeholder="Enter the full recipe code"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Find recipe
          </button>
        </form>
        {state.recipeCodeSearch && !controls.recipeLookup?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No unique exact active recipe match is available. Duplicate codes
            fail closed; resolve existing code ambiguity before selecting one.
          </p>
        ) : null}
      </section>
      <section
        aria-label="Find an exact foodservice variant SKU"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Exact variant SKU
            <input
              type="search"
              name="foodserviceSkuSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.foodserviceSkuSearch ?? ""}
              placeholder="Enter the full SKU"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Find variant
          </button>
        </form>
        {state.foodserviceSkuSearch &&
        !controls.foodserviceVariantLookup?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No unique exact active tracked variant match is available. Duplicate
            SKUs fail closed; resolve existing SKU ambiguity before selecting.
          </p>
        ) : null}
      </section>
      <section
        aria-label="Find an exact location code"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Exact location code
            <input
              type="search"
              name="foodserviceLocationCodeSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.foodserviceLocationCodeSearch ?? ""}
              placeholder="Enter the full location code"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Find location
          </button>
        </form>
        {state.foodserviceLocationCodeSearch &&
        !controls.foodserviceLocationLookup?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No unique exact active location match is available. Duplicate codes
            fail closed; resolve existing code ambiguity before selecting one.
          </p>
        ) : null}
      </section>
      <section
        aria-label="Find an exact prep-batch number"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Exact prep-batch number
            <input
              type="search"
              name="foodserviceBatchNumberSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.foodserviceBatchNumberSearch ?? ""}
              placeholder="Enter the full batch number"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Find batch
          </button>
        </form>
        {state.foodserviceBatchNumberSearch &&
        !controls.openPrepBatchLookup?.length &&
        !controls.prepBatchLookup?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No unique exact eligible prep-batch match is available.
          </p>
        ) : null}
      </section>
      <section
        aria-label="Find an exact employee number"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Exact employee number
            <input
              type="search"
              name="foodserviceEmployeeNumberSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.foodserviceEmployeeNumberSearch ?? ""}
              placeholder="Enter the full employee number"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Find employee
          </button>
        </form>
        {state.foodserviceEmployeeNumberSearch &&
        !controls.employeeLookup?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No unique exact active employee match is available.
          </p>
        ) : null}
      </section>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ActionPanel title="Configure recipe" description="Creates or updates one active output recipe with an inventory-tracked ingredient. Yield and ingredient units must match their variants exactly; automatic unit conversion is not supported.">
          <FormGrid action={configurePreparedFoodRecipeAction} submit="Save recipe">
            <HiddenScope projection={projection} returnPath={path} />
            <TextField label="Recipe name" name="name" required />
            <TextField label="Recipe code" name="code" placeholder="breakfast-sandwich" required />
            <SelectField label="Output variant" name="outputVariantId" options={variantSelectorOptions} />
            <TextField label="Yield quantity" name="yieldQuantity" defaultValue="1" inputMode="decimal" required />
            <TextField label="Yield unit (match output variant)" name="yieldUnit" defaultValue="each" required />
            <SelectField label="Ingredient variant" name="inputVariantId" options={variantSelectorOptions} />
            <TextField label="Ingredient name snapshot" name="ingredientName" required />
            <TextField label="Ingredient quantity" name="ingredientQuantity" defaultValue="1" inputMode="decimal" required />
            <TextField label="Ingredient unit (match inventory variant)" name="ingredientUnit" defaultValue="each" required />
            <TextField label="Instructions" name="instructions" />
            <TextField label="Allergen notes" name="allergenNotes" />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Start prep batch" description="Creates an in-progress batch bound to an active recipe, employee, store, and planned output.">
          <FormGrid action={startPrepBatchAction} submit="Start batch">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Recipe" name="recipeId" options={recipeSelectorOptions} />
            <SelectField label="Prepared by" name="employeeId" options={employeeSelectorOptions} />
            <TextField label="Quantity planned" name="quantityPlanned" inputMode="decimal" required />
            <TextField label="Expiry (ISO + offset)" name="expiresAt" placeholder="2026-07-20T14:00:00-04:00" />
            <TextField label="Notes" name="notes" />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Complete prep batch" description="Consumes ingredient lots and posts the output lot and ledger evidence atomically.">
          <FormGrid action={completePrepBatchAction} submit="Complete batch">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Prep batch" name="prepBatchId" options={openPrepBatchSelectorOptions} />
            <SelectField label="Output location" name="locationId" options={locationSelectorOptions} />
            <SelectField label="Prepared by" name="employeeId" options={employeeSelectorOptions} />
            <TextField label="Quantity made" name="quantityMade" inputMode="decimal" required />
            <TextField label="Lot number (optional)" name="lotNumber" />
            <TextField label="Expiry (ISO + offset)" name="expiresAt" placeholder="2026-07-20T14:00:00-04:00" />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Record waste" description="Reduces on-hand inventory and captures reason, quantity, cost, and source evidence.">
          <FormGrid action={recordWasteAction} submit="Post waste">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Location" name="locationId" options={locationSelectorOptions} />
            <SelectField label="Variant" name="variantId" options={variantSelectorOptions} />
            <SelectField label="Prep batch (optional)" name="prepBatchId" options={prepBatchSelectorOptions} required={false} />
            <SelectField label="Logged by" name="employeeId" options={employeeSelectorOptions} />
            <EnumField label="Reason" name="reason" values={[{ value: "expired", label: "Expired" }, { value: "spoilage", label: "Spoilage" }, { value: "preparation_error", label: "Preparation error" }, { value: "overproduction", label: "Overproduction" }, { value: "quality", label: "Quality" }, { value: "damaged", label: "Damaged" }, { value: "other", label: "Other" }]} />
            <TextField label="Quantity" name="quantity" inputMode="decimal" required />
            <TextField label="Notes" name="notes" />
          </FormGrid>
        </ActionPanel>
      </div>
      <EvidenceTable rows={projection.rows} title="Prep batches" />
    </> : null}
  </PlatformPage>;
}
