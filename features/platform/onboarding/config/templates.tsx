import { Package, Store } from "lucide-react";

import seed from "../lib/seed.json";
import {
  DEFAULT_STORE_LOGO_COLOR,
  DEFAULT_STORE_LOGO_ICON,
} from "../../store-settings/lib/store-logo";

// Onboarding templates, in the shape E-commerce and Restaurant use: what each
// starting point creates, read from lib/seed.json so the list never drifts from
// what the onboarding mutation writes.
export type ConvenienceTemplateId = "sample" | "blank";

export interface ConvenienceTemplate {
  name: string;
  description: string;
  icon: React.ReactNode;
  /** Form values the template fills in; the owner reviews them before submitting. */
  formValues: Record<string, string>;
  /** Store Settings logo the new business starts with. */
  logo: { icon: string; color: string };
  displayNames: {
    storeInfo: string[];
    locations: string[];
    registers: string[];
    taxCategories: string[];
    paymentMethods: string[];
    categories: string[];
    products: string[];
    loyalty: string[];
  };
}

const defaultLogo = { icon: DEFAULT_STORE_LOGO_ICON, color: DEFAULT_STORE_LOGO_COLOR };

// Every store gets these, sample catalog or not.
const baseNames = {
  storeInfo: ["Store Settings"],
  locations: seed.inventoryLocations.map((location) => location.name),
  registers: [seed.register.name],
  taxCategories: seed.taxCategories.map((category) => category.name),
  paymentMethods: [seed.paymentProvider.name],
  loyalty: [seed.loyaltyProgram.name],
};

export const CONVENIENCE_TEMPLATES: Record<ConvenienceTemplateId, ConvenienceTemplate> = {
  sample: {
    name: "Sample store",
    description: `${seed.storefront.name}: sample business details and ${seed.demoProducts.length} products.`,
    icon: <Store className="h-5 w-5" />,
    formValues: seed.sampleForm,
    logo: defaultLogo,
    displayNames: {
      ...baseNames,
      categories: seed.demoCategories.map((category) => category.name),
      products: seed.demoProducts.map((product) => product.title),
    },
  },
  blank: {
    name: "Blank",
    description: "Your own details, with no products yet.",
    icon: <Package className="h-5 w-5" />,
    formValues: {},
    logo: defaultLogo,
    displayNames: {
      ...baseNames,
      categories: [],
      products: [],
    },
  },
};

export interface SectionDefinition {
  id: number;
  type: keyof ConvenienceTemplate["displayNames"];
  label: string;
  getItemsFn: (template: ConvenienceTemplateId) => string[];
}

const section = (id: number, type: SectionDefinition["type"], label: string): SectionDefinition => ({
  id,
  type,
  label,
  getItemsFn: (template) => CONVENIENCE_TEMPLATES[template].displayNames[type],
});

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  section(1, "storeInfo", "Store information"),
  section(2, "locations", "Inventory locations"),
  section(3, "registers", "Registers"),
  section(4, "taxCategories", "Tax categories"),
  section(5, "paymentMethods", "Payment methods"),
  section(6, "loyalty", "Loyalty"),
  section(7, "categories", "Product categories"),
  section(8, "products", "Products"),
];

export const STORE_TEMPLATES = CONVENIENCE_TEMPLATES;
