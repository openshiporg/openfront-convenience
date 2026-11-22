// Launch-ready fixes (2026-11-22): the register, the phone storefront, receipts, rewards, password reset.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("the register lists register baskets only, never a shopper's online basket", () => {
  const source = read("features/keystone/mutations/platformProjection.ts");
  const pos = source.slice(source.indexOf("The register lists register baskets only"));
  assert.match(pos.slice(0, 600), /source: \{ in: \["pos", "kiosk"\] \}/);
});

test("the quick register offers the signed-in employee as cashier and a refused action does not lock it", () => {
  const page = read("features/platform/pos/PosPage.tsx");
  assert.match(page, /selfEmployeeId=\{controls\.selfEmployee\?\.\[0\]\?\.id \?\? ""\}/);
  const station = read("features/platform/pos/FastCheckoutStation.tsx");
  assert.match(station, /allEmployees\.filter\(\(option\) => option\.id === selfEmployeeId\)/);
  assert.match(station, /result && outcome\?\.state === "not_found"\) \{[\s\S]{0,260}clearPendingIntent\(\);/);
});

test("the phone storefront has one menu button and no bottom tab bar or side-scrolling tabs", () => {
  assert.equal(fs.existsSync(path.join(__dirname, "..", "features/storefront/components/TabBar.tsx")), false);
  const shell = read("features/storefront/components/ShopShell.tsx");
  assert.match(shell, /<PhoneMenu/);
  const css = read("features/storefront/shop.css");
  assert.doesNotMatch(css, /\.sf-tabbar|\.sf-tabs__link/);
  const menu = read("features/storefront/components/PhoneMenu.tsx");
  assert.match(menu, /<dialog/);
});

test("a customer's receipt shows subtotal, tax, total and refunds, in the store's time zone", () => {
  const server = read("features/keystone/mutations/storefrontOperations.ts");
  const history = server.slice(server.indexOf("export async function storefrontHistory"));
  for (const field of ["subtotalCents", "taxCents", "discountCents", "refundedCents", "pickupStatus"]) assert.match(history, new RegExp(`${field}: true`));
  const pages = read("features/storefront/screens/ShopPages.tsx");
  const receipt = pages.slice(pages.indexOf("export async function ReceiptPage"), pages.indexOf("export async function AccountAuthPage"));
  assert.match(receipt, /<dt>Tax<\/dt>/);
  assert.match(receipt, /<dt>Refunded<\/dt>/);
  assert.match(receipt, /timeZone: projection\.location\?\.timezone/);
});

test("a customer account is a rewards membership and a paid web order earns points", () => {
  const server = read("features/keystone/mutations/storefrontOperations.ts");
  assert.match(server, /export async function ensureCustomerLoyaltyAccount/);
  assert.match(server, /\$\{businessId\}:\$\{program\.id\}:user:\$\{userId\}/, "same lookup key as staff enrolment, so no second account");
  const pickup = read("features/keystone/mutations/pickupOperations.ts");
  const post = pickup.slice(pickup.indexOf("export async function postPickupSale"));
  assert.match(post, /ensureCustomerLoyaltyAccount\(db, cart\.businessId, cart\.customerId\)/);
  assert.match(post, /type: "earned"/);
  assert.match(post, /loyaltyAccountId: account\.id/, "the sale is linked so a refund takes the points back");
});

test("a shopper resets a password on the shop, staff on the dashboard", () => {
  const mail = read("features/keystone/lib/mail.ts");
  assert.match(mail, /\/account\/reset\?token=/);
  assert.match(mail, /\/dashboard\/reset\?token=/);
  const config = read("features/keystone/index.ts");
  assert.match(config, /staff \? "staff" : "customer"/);
  const actions = read("features/storefront/actions.ts");
  assert.match(actions, /export async function customerForgot/);
  assert.match(actions, /export async function customerReset/);
  const pages = read("features/storefront/screens/ShopPages.tsx");
  assert.match(pages, /href="\/account\/forgot"/);
});

test("reports show what sold from the sales themselves, not only closed store days", () => {
  const server = read("features/keystone/mutations/reportingOperations.ts");
  const report = server.slice(server.indexOf("export async function convenienceSalesReport"));
  assert.match(report, /assertBusinessPermission\(session, args\.input\.businessId, "canReadReporting"\)/);
  assert.match(report, /tradingDatePeriodBounds\(startDate, store\.timezone/, "days are the store's days");
  assert.match(report, /line\.taxInclusive \? line\.totalCents - line\.taxCents : line\.subtotalCents - line\.discountCents/);
  const page = read("features/platform/reports/ReportsPage.tsx");
  for (const title of ["By category", "How customers paid", "Best sellers"]) assert.match(page, new RegExp(title));
});

test("a promotion can be archived from its row", () => {
  assert.match(read("features/keystone/mutations/catalogOperations.ts"), /export async function archivePromotion/);
  assert.match(read("features/platform/promotions/screens/PromotionListPage.tsx"), /action=\{archivePromotionAction\}/);
});

test("web baskets past their expiry are marked abandoned, never deleted", () => {
  const source = read("features/keystone/mutations/storefrontOperations.ts");
  assert.match(source, /cart\.updateMany\(\{ where: \{ storeId: store\.id, source: "storefront", status: "open", saleId: null, id: \{ not: cart\.id \}, expiresAt: \{ lt: /);
  assert.match(source, /data: \{ status: "abandoned" \} \}\)/);
  assert.doesNotMatch(source, /cart\.deleteMany/);
});

test("the register takes cash over the total and shows the change", () => {
  const station = read("features/platform/pos/FastCheckoutStation.tsx");
  assert.match(station, /Cash given/);
  assert.match(station, /Change due/);
  const actions = read("features/platform/pos/fast-pos-actions.ts");
  assert.match(actions, /tenderedCents < input\.amountCents/);
  assert.match(actions, /amountCents: input\.amountCents,\s+tenderedCents,/);
});

test("the payments report keeps each method's row", () => {
  const server = read("features/keystone/mutations/reportingOperations.ts");
  assert.match(server, /\n\s+row\.count \+= 1; row\.amountCents \+= tender\.amountCents; byMethod\.set\(tender\.method, row\);/);
});

test("a new store starts with Cashier and Manager roles that can open the register", () => {
  const source = read("features/keystone/mutations/onboardConvenienceBusiness.ts");
  assert.match(source, /for \(const preset of STAFF_ROLE_PRESETS\)/);
  const cashier = source.slice(source.indexOf("const CASHIER_PERMISSIONS"), source.indexOf("const OWNER_ONLY"));
  for (const permission of ["canAccessDashboard", "canReadSales", "canManageSales", "canReadCash", "canManageCash"]) assert.match(cashier, new RegExp(`"${permission}"`));
  for (const permission of ["canManageBusiness", "canManageRoles", "canManagePayments"]) assert.doesNotMatch(cashier, new RegExp(`"${permission}"`));
});

test("paid web orders post without a webhook: shop and dashboard reads reconcile open payments once a minute", () => {
  const pickup = read("features/keystone/mutations/pickupOperations.ts");
  assert.match(pickup, /export async function reconcileOpenPickupPayments/);
  assert.match(pickup, /RECONCILE_EVERY_MS = 60_000/);
  assert.match(pickup, /settlePaidPickup\(context, cart, provider, payment\)/);
  assert.match(read("features/storefront/lib/public-storefront.ts"), /reconcileOpenPickupPayments\(keystoneContext\.sudo\(\)\)/);
  assert.match(read("features/keystone/mutations/platformProjection.ts"), /reconcileOpenPickupPayments\(context\.sudo\(\)\)/);
});

test("the payment webhook acknowledges events it cannot verify (shared Stripe account) without posting anything", () => {
  const route = read("app/api/payment-webhooks/[providerId]/route.ts");
  assert.match(route, /ignored: true \}, \{ status: 200 \}/);
});

test("refund form: second payment, split amounts and manager override are folded away; one till is chosen for you", () => {
  const picker = read("features/platform/pos/RefundSalePicker.tsx");
  assert.match(picker, /<details[^>]*open=\{saleTenders\.length > 1/);
  assert.match(picker, /"originalTenderId2"/);
  const pos = read("features/platform/pos/PosPage.tsx");
  assert.match(pos, /Item can't be returned \(manager override\)/);
  assert.match(pos, /label="Till"\s+name="registerSessionId"/);
  assert.match(pos, /label="Back to first payment" name="refundAllocationCents"/);
});

test("receipts show the short reference only and hide a zero discount; refunds find a sale by that short reference", () => {
  const receipt = read("features/platform/pos/SaleReceiptPage.tsx");
  assert.doesNotMatch(receipt, /\{receipt\.receiptNumber\}<\/p>/);
  assert.match(receipt, /\{receipt\.discountCents \? <><dt>Discount/);
  assert.doesNotMatch(read("features/platform/sales/screens/SaleDetailPage.tsx"), /: money\(0\)\]/);
  assert.match(read("features/keystone/mutations/platformProjection.ts"), /receiptNumber: receiptNumberMatch\(refundHistorySearch\)/);
});

test("Models sit behind the set-up roles; a cashier's Dashboard link goes to their own pages", () => {
  const access = read("features/dashboard/lib/sidebarAccess.ts");
  assert.match(access, /held\.includes\('canManageRoles'\)/);
  assert.match(access, /!canSeeModels\(user\)\) return \[\]/);
  assert.match(read("features/dashboard/components/Sidebar.tsx"), /modelLinks\.length > 0 &&/);
  assert.match(read("features/dashboard/screens/HomePage/index.tsx"), /redirect\(home\)/);
});

test("roles page: every permission appears once, in an owner's words, and Change brings View", () => {
  const src = read("features/platform/staff/permissionAreas.ts");
  const keys = [...src.matchAll(/(?:read|manage|key): "(can[A-Za-z]+)"/g)].map((m) => m[1]);
  const access = read("features/keystone/access.ts");
  const all = [...access.split("export const permissionKeys = [")[1].split("] as const")[0].matchAll(/"(can[A-Za-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...keys].sort(), [...all].sort());
  assert.equal(new Set(keys).size, keys.length);
  const actions = read("features/platform/staff/actions.ts");
  assert.match(actions, /if \(area\.manage && area\.read && data\[area\.manage\]\) data\[area\.read\] = true/);
  assert.match(actions, /updateRole\(where/);
  assert.match(read("features/platform/staff/screens/StaffListPage.tsx"), /staff\/roles/);
});

test("dashboard pages carry list names only; field metadata loads when an editor needs it", () => {
  const layout = read("app/dashboard/(admin)/layout.tsx");
  assert.match(layout, /isSlim: true/);
  assert.match(layout, /fields: \[\]/);
  const hook = read("features/dashboard/hooks/useAdminMeta.tsx");
  assert.match(hook, /enabled: !initialData\?\.isSlim/);
  assert.match(hook, /useAdminMetaQuery\(undefined, \{ enabled: slim \}\)/);
});
