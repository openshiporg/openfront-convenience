type Address = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateProvince: string;
  postalCode: string;
};

/** One format everywhere: "100 QA Street, Brooklyn, NY 11201". */
export function addressParts(location: Address) {
  const street = [location.addressLine1, location.addressLine2].filter(Boolean).join(", ");
  const region = [location.stateProvince, location.postalCode].filter(Boolean).join(" ");
  const locality = [location.city, region].filter(Boolean).join(", ");
  return { street, locality, full: [street, locality].filter(Boolean).join(", ") };
}
