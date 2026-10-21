import {
  AlertTriangle,
  BadgePercent,
  BarChart3,
  Boxes,
  ClipboardCheck,
  CookingPot,
  CreditCard,
  FileOutput,
  Fuel,
  Gauge,
  HeartHandshake,
  Landmark,
  RefreshCcw,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Ticket,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";

export interface PlatformNavItem {
  title: string;
  href: string;
  color: string;
  description: string;
  icon: LucideIcon;
  group?: string;
}

export interface PlatformNavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: PlatformNavItem[];
}

export const platformNavItems: PlatformNavItem[] = [
  // Standalone
  { title: "Overview",       href: "/platform",                color: "teal",    description: "Today's sales, fuel, stock and open issues across your stores.", icon: Gauge,          group: "standalone" },
  { title: "POS & Cash",     href: "/platform/pos",            color: "emerald", description: "Ring up sales, take payment and manage cash drawers.",           icon: ShoppingBasket, group: "standalone" },
  { title: "Store Settings", href: "/platform/store-settings", color: "slate",   description: "Configure store details, logo and storefront.",                  icon: Store,          group: "standalone" },

  // Store day
  { title: "Fuel",           href: "/platform/fuel",           color: "orange",  description: "Fuel grades, prices, tank readings and pump sales.",             icon: Fuel,           group: "store-day" },
  { title: "Reconciliation", href: "/platform/reconciliation", color: "emerald", description: "Close the store day and reconcile cash and card totals.",        icon: ClipboardCheck, group: "store-day" },
  { title: "Exceptions",     href: "/platform/exceptions",     color: "red",     description: "Review voids, overrides and variances that need attention.",      icon: AlertTriangle,  group: "store-day" },
  { title: "Recovery",       href: "/platform/recovery",       color: "slate",   description: "Resolve offline sales and failed syncs.",                        icon: RefreshCcw,     group: "store-day" },

  // Catalog & stock
  { title: "Inventory",      href: "/platform/inventory",      color: "blue",    description: "Stock levels, counts and adjustments.",                          icon: Boxes,          group: "catalog" },
  { title: "Purchasing",     href: "/platform/purchasing",     color: "indigo",  description: "Vendors, purchase orders and deliveries.",                       icon: ReceiptText,    group: "catalog" },
  { title: "Pricing",        href: "/platform/pricing",        color: "pink",    description: "Price books, tax rates and promotions.",                         icon: BadgePercent,   group: "catalog" },
  { title: "Foodservice",    href: "/platform/foodservice",    color: "amber",   description: "Prepared food recipes, batches and waste.",                      icon: CookingPot,     group: "catalog" },

  // Regulated services
  { title: "Restricted Sales", href: "/platform/restricted-sales", color: "rose",   description: "Age-restricted products and ID check policies.",           icon: ShieldCheck,    group: "regulated" },
  { title: "Lottery",          href: "/platform/lottery",          color: "purple", description: "Lottery games, packs and settlements.",                    icon: Ticket,         group: "regulated" },
  { title: "Money Services",   href: "/platform/money-services",   color: "cyan",   description: "Money orders, bill payments and transfers.",               icon: Landmark,       group: "regulated" },
  { title: "Payments",         href: "/platform/payments",         color: "slate",  description: "Payment providers, terminals and refunds.",                icon: CreditCard,     group: "regulated" },

  // Customers & reports
  { title: "Loyalty",        href: "/platform/loyalty",        color: "rose",    description: "Loyalty members and point balances.",                            icon: HeartHandshake, group: "customers" },
  { title: "Reports",        href: "/platform/reports",        color: "indigo",  description: "Sales, fuel and inventory reports.",                             icon: BarChart3,      group: "customers" },
  { title: "Exports",        href: "/platform/exports",        color: "violet",  description: "Export sales and tax data to accounting.",                       icon: FileOutput,     group: "customers" },
];

export const platformStandaloneItems = platformNavItems.filter(
  (item) => item.group === "standalone",
);

export const platformNavGroups: PlatformNavGroup[] = [
  { id: "store-day", title: "Store Day",           icon: ClipboardCheck, items: platformNavItems.filter((i) => i.group === "store-day") },
  { id: "catalog",   title: "Catalog & Stock",     icon: Boxes,          items: platformNavItems.filter((i) => i.group === "catalog") },
  { id: "regulated", title: "Regulated Services",  icon: ShieldCheck,    items: platformNavItems.filter((i) => i.group === "regulated") },
  { id: "customers", title: "Customers & Reports", icon: BarChart3,      items: platformNavItems.filter((i) => i.group === "customers") },
];

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({
    ...item,
    href: `${basePath}${item.href}`,
  }));
}
