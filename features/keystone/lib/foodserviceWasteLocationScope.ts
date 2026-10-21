export function foodserviceWasteLocationWhere(input: {
  locationId: string;
  businessId: string;
  storeId: string;
}) {
  return {
    id: input.locationId,
    businessId: input.businessId,
    storeId: input.storeId,
    status: "active" as const,
  };
}
