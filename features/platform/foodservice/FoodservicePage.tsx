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
  LookupForm,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { PanelGrid } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
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
  return <PlatformPage title="Foodservice" {...state}>
    {projection ? (
      <Workbench
        scope="foodservice"
        sections={[
          {
            id: "prep",
            label: "Prep",
            count: projection.rows.length,
            content: (
              <>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="foodserviceBatchNumberSearch"
                    label="Batch number"
                    placeholder="Full batch number"
                    defaultValue={state.foodserviceBatchNumberSearch}
                    submit="Find"
                    empty={state.foodserviceBatchNumberSearch && !controls.openPrepBatchLookup?.length && !controls.prepBatchLookup?.length ? "No batch with that number" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="recipeCodeSearch"
                    label="Recipe code"
                    placeholder="Full recipe code"
                    defaultValue={state.recipeCodeSearch}
                    submit="Find"
                    empty={state.recipeCodeSearch && !controls.recipeLookup?.length ? "No recipe with that code" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="foodserviceLocationCodeSearch"
                    label="Location code"
                    placeholder="Full location code"
                    defaultValue={state.foodserviceLocationCodeSearch}
                    submit="Find"
                    empty={state.foodserviceLocationCodeSearch && !controls.foodserviceLocationLookup?.length ? "No location with that code" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="foodserviceEmployeeNumberSearch"
                    label="Employee number"
                    placeholder="Full employee number"
                    defaultValue={state.foodserviceEmployeeNumberSearch}
                    submit="Find"
                    empty={state.foodserviceEmployeeNumberSearch && !controls.employeeLookup?.length ? "No employee with that number" : false}
                  />
                </div>
                <PanelGrid>
                  <ActionPanel title="Start prep batch">
                    <FormGrid action={startPrepBatchAction} submit="Start batch">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Recipe" name="recipeId" options={recipeSelectorOptions} />
                      <SelectField label="Prepared by" name="employeeId" options={employeeSelectorOptions} />
                      <TextField label="Quantity planned" name="quantityPlanned" inputMode="decimal" required />
                      <TextField label="Expiry (ISO + offset)" name="expiresAt" placeholder="2026-07-20T14:00:00-04:00" />
                      <TextField label="Notes" name="notes" />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Complete prep batch">
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
                </PanelGrid>
                <EvidenceTable rows={projection.rows} timeZone={projection.timezone} title="Prep batches" />
              </>
            ),
          },
          {
            id: "waste",
            label: "Waste",
            content: (
              <>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="foodserviceSkuSearch"
                    label="SKU"
                    placeholder="Full SKU"
                    defaultValue={state.foodserviceSkuSearch}
                    submit="Find"
                    empty={state.foodserviceSkuSearch && !controls.foodserviceVariantLookup?.length ? "No item with that SKU" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="foodserviceLocationCodeSearch"
                    label="Location code"
                    placeholder="Full location code"
                    defaultValue={state.foodserviceLocationCodeSearch}
                    submit="Find"
                    empty={state.foodserviceLocationCodeSearch && !controls.foodserviceLocationLookup?.length ? "No location with that code" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="foodserviceBatchNumberSearch"
                    label="Batch number"
                    placeholder="Full batch number"
                    defaultValue={state.foodserviceBatchNumberSearch}
                    submit="Find"
                    empty={state.foodserviceBatchNumberSearch && !controls.openPrepBatchLookup?.length && !controls.prepBatchLookup?.length ? "No batch with that number" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="foodserviceEmployeeNumberSearch"
                    label="Employee number"
                    placeholder="Full employee number"
                    defaultValue={state.foodserviceEmployeeNumberSearch}
                    submit="Find"
                    empty={state.foodserviceEmployeeNumberSearch && !controls.employeeLookup?.length ? "No employee with that number" : false}
                  />
                </div>
                <PanelGrid>
                  <ActionPanel title="Record waste">
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
                </PanelGrid>
              </>
            ),
          },
          {
            id: "recipes",
            label: "Recipes",
            content: (
              <>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="recipeCodeSearch"
                    label="Recipe code"
                    placeholder="Full recipe code"
                    defaultValue={state.recipeCodeSearch}
                    submit="Find"
                    empty={state.recipeCodeSearch && !controls.recipeLookup?.length ? "No recipe with that code" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                    name="foodserviceSkuSearch"
                    label="SKU"
                    placeholder="Full SKU"
                    defaultValue={state.foodserviceSkuSearch}
                    submit="Find"
                    empty={state.foodserviceSkuSearch && !controls.foodserviceVariantLookup?.length ? "No item with that SKU" : false}
                  />
                </div>
                <PanelGrid>
                  <ActionPanel title="Configure recipe">
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
                </PanelGrid>
              </>
            ),
          },
        ]}
      />
    ) : null}
  </PlatformPage>;
}
