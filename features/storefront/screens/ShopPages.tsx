import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";

import { ShopShell } from "../components/ShopShell";
import { Price } from "../components/Price";
import { CategoryRail, CheckoutDock, SidePanel } from "../components/Aside";
import { ProductPhoto, ProductRow, categoryHref, lineFor, priceOf, variantSize } from "../components/ProductRow";
import { Stepper } from "../components/Stepper";
import { ReorderBanner } from "../components/Reorder";
import { basket, catalog, currentCustomer, customerHistory, customerRewards, firstPage, history, money } from "../lib/data";
import { getPublicStorefrontProjection } from "../lib/public-storefront";
import { customerAuth, customerSignout } from "../actions";
import { storefrontTitle } from "../lib/metadata";

export const shopMetadata = () => storefrontTitle("Shop");
export const accountMetadata = () => storefrontTitle("Account");
export async function accountAuthMetadata({ params }: { params: Promise<{ mode: string }> }) {
  const { mode } = await params;
  return storefrontTitle(mode === "signup" ? "Create account" : "Sign in");
}
export async function productMetadata({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const data = await catalog({ productId });
  return storefrontTitle(data?.products[0]?.title ?? "Product");
}

type Search = Promise<{ q?: string; category?: string; page?: string; error?: string; from?: string }>;
// Error codes map to fixed text; the query string is never rendered.
const errorMessages: Record<string, string> = {
  basket: "Basket could not be updated",
  signup: "Account could not be created",
  signin: "Email or password incorrect",
  password: "Choose a less common password",
};
const errorMessage = (code?: string) => (code ? errorMessages[code] : undefined);

function Alert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="sf-alert">
      <span className="sf-dot" data-tone="danger" aria-hidden="true" />
      {message}
    </p>
  );
}

const orderTone = (status: string) =>
  /complete|paid|fulfilled/.test(status) ? "ok" : /void|cancel|refund|fail/.test(status) ? "danger" : "warn";
const statusLabel = (status: string) => {
  const text = status.replaceAll("_", " ");
  return text[0]?.toUpperCase() + text.slice(1);
};
const quantityLabel = (value: string) => String(Number(value));
export const receiptMetadata = () => storefrontTitle("Receipt");
const itemCount = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

/** How buying works here, said once where it matters. */
function CounterNote({ arrived = false, onlinePickup = false }: { arrived?: boolean; onlinePickup?: boolean }) {
  return (
    <p role={arrived ? "status" : undefined} className="sf-note" data-arrived={arrived || undefined}>
      <Info aria-hidden="true" className="sf-icon" />
      <span>
        {onlinePickup ? (
          "Order online and pay by card, then pick up in store. Age-restricted items are sold in store only."
        ) : (
          <>
            {arrived ? <strong>Online ordering is not open yet. </strong> : null}
            Prices here are the shelf prices. Pick items up in store and pay at the counter.
          </>
        )}
      </span>
    </p>
  );
}

export async function ShopPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const query = (search.q ?? "").slice(0, 100);
  const category = search.category ?? "";
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const [data, projection, current, orders] = await Promise.all([
    catalog({ search: query || undefined, category: category || undefined, page }),
    getPublicStorefrontProjection(),
    basket(),
    customerHistory(),
  ]);
  const products = data?.products ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const onlinePickup = Boolean(data?.onlinePickup);
  const href = (next: { page?: number }) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const value = params.toString();
    return value ? `/shop?${value}` : "/shop";
  };
  const madeInStore = new Set(projection.categories.flatMap((entry) => entry.products.filter((product) => product.preparedFood).map((product) => product.id)));
  const arrived = search.from === "basket" || search.from === "checkout";
  const reorderData = orders.length ? await firstPage() : null;
  return (
    <ShopShell active={category} query={query}>
      <div className="sf-layout sf-layout--panel">
        <CategoryRail categories={data?.categories ?? []} active={category} title="Categories" />
        <section className="sf-list" aria-labelledby="sf-list-title">
          <div className="sf-listhead">
            <h1 id="sf-list-title" className="sf-listhead__title">
              {query ? (
                <>
                  Results for <q>{query}</q>
                </>
              ) : (
                category || "All products"
              )}
            </h1>
            {data ? <span className="sf-listhead__count sf-num">{itemCount(data.total)}</span> : null}
            {query ? (
              <Link href={category ? categoryHref(category) : "/shop"} className="sf-link">
                Clear search
              </Link>
            ) : null}
          </div>
          {arrived ? <CounterNote arrived onlinePickup={onlinePickup} /> : null}
          {!query && page === 1 ? <ReorderBanner order={orders[0]} data={reorderData} /> : null}
          {products.length && data ? (
            <ul className="sf-rows sf-rows--compact">
              {products.map((product, index) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  currency={data.currency}
                  lines={current?.lines ?? []}
                  onlinePickup={onlinePickup}
                  madeInStore={madeInStore.has(product.id)}
                  eager={index < 4}
                />
              ))}
            </ul>
          ) : (
            <p role="status" className="sf-empty">
              <span className="sf-dot" data-tone="muted" aria-hidden="true" />
              {data ? "No products found" : "Products could not be loaded"}
            </p>
          )}
          {pages > 1 ? (
            <nav className="sf-pager" aria-label="Pages">
              {page > 1 ? (
                <Link href={href({ page: page - 1 })} className="sf-ctl" aria-label="Previous page">
                  <ArrowLeft aria-hidden="true" className="sf-icon" />
                </Link>
              ) : null}
              <span className="sf-ctl sf-num" aria-current="page">
                {page} / {pages}
              </span>
              {page < pages ? (
                <Link href={href({ page: page + 1 })} className="sf-ctl" aria-label="Next page">
                  <ArrowRight aria-hidden="true" className="sf-icon" />
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
        <SidePanel basket={current} onlinePickup={onlinePickup} location={projection.location} />
      </div>
      {onlinePickup ? <CheckoutDock basket={current} /> : null}
    </ShopShell>
  );
}

const stockLabel = { in_stock: { tone: "ok", label: "In stock" }, ask: { tone: "muted", label: "Ask in store for stock" } } as const;

export async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const [data, projection, current] = await Promise.all([catalog({ productId }), getPublicStorefrontProjection(), basket()]);
  const product = data?.products[0];
  if (!product || !data) notFound();
  const onlinePickup = Boolean(data.onlinePickup);
  const single = product.variants.length === 1;
  const madeInStore = projection.categories.some((category) => category.products.some((entry) => entry.id === product.id && entry.preparedFood));
  const related = await catalog({ category: product.category });
  const others = (related?.products ?? []).filter((entry) => entry.id !== product.id).slice(0, 4);
  return (
    <ShopShell active={product.category}>
      <div className="sf-layout sf-layout--panel">
        <CategoryRail categories={data.categories} active={product.category} title="Categories" />
        <section className="sf-list" aria-labelledby="sf-product-title">
          <Link href={categoryHref(product.category)} className="sf-back">
            <ArrowLeft aria-hidden="true" className="sf-icon" />
            {product.category}
          </Link>
          <article className="sf-product">
            <ProductPhoto product={product} className="sf-product__photo" eager />
            <div className="sf-product__body">
              <h1 id="sf-product-title" className="sf-product__title">
                {product.title}
              </h1>
              <p className="sf-row__cat">
                {product.category}
                {madeInStore ? <span className="sf-row__mark"> · Made in store</span> : null}
              </p>
              {product.description ? <p className="sf-product__description">{product.description}</p> : null}
              <ul className="sf-sizes" aria-label={single ? "Price" : "Sizes"}>
                {product.variants.map((variant) => {
                  const price = priceOf([variant]);
                  const size = variantSize(variant, product.title) || (single ? "" : variant.title);
                  const stock = price && variant.availability !== "untracked" ? stockLabel[variant.availability] : null;
                  const line = lineFor(current?.lines ?? [], product, variant);
                  return (
                    <li key={variant.id} className="sf-size">
                      <span className="sf-size__name">
                        {size || "Each"}
                        {stock ? (
                          <span className="sf-size__stock">
                            <span className="sf-dot" data-tone={stock.tone} aria-hidden="true" />
                            {stock.label}
                          </span>
                        ) : null}
                      </span>
                      <span className="sf-size__price">{price ? <Price cents={price.from} currency={data.currency} /> : <span className="sf-row__ask">Price in store</span>}</span>
                      {onlinePickup && price ? (
                        <Stepper variantId={variant.id} lineId={line?.id ?? null} quantity={line ? Number(line.quantity) : 0} name={`${product.title}${size ? ` ${size}` : ""}`} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <CounterNote onlinePickup={onlinePickup} />
            </div>
          </article>
          {others.length && related ? (
            <section className="sf-related" aria-labelledby="sf-related-title">
              <h2 id="sf-related-title" className="sf-related__title">
                More in {product.category}
              </h2>
              <ul className="sf-rows sf-rows--compact">
                {others.map((entry) => (
                  <ProductRow key={entry.id} product={entry} currency={related.currency} lines={current?.lines ?? []} onlinePickup={onlinePickup} />
                ))}
              </ul>
            </section>
          ) : null}
        </section>
        <SidePanel basket={current} onlinePickup={onlinePickup} location={projection.location} />
      </div>
    </ShopShell>
  );
}

// The storefront is a catalog: orders are paid at the counter, and there is no
// online payment provider, so the basket and checkout routes lead back to the shop,
// which then says why.
export async function BasketPage() {
  redirect("/shop?from=basket");
}

export async function CheckoutPage() {
  redirect("/shop?from=checkout");
}

const shortDate = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function PageHead({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="sf-listhead">
      <h1 className="sf-listhead__title">{title}</h1>
      {children}
    </div>
  );
}

export async function AccountPage() {
  const user = await currentCustomer();
  const [orders, accounts] = await Promise.all([customerHistory(), customerRewards()]);
  return (
    <ShopShell showCategories={false}>
      <div className="sf-page">
        <PageHead title="Account" />
        {user ? (
          <section className="sf-card sf-profile" aria-label="Profile">
            <div>
              <p className="sf-profile__name">{user.name}</p>
              <p className="sf-muted">{user.email}</p>
            </div>
            <form action={customerSignout}>
              <button className="sf-btn sf-btn--quiet">Sign out</button>
            </form>
          </section>
        ) : (
          <section className="sf-card sf-profile" aria-label="Sign in">
            <p className="sf-muted">Sign in to see your points and receipts.</p>
            <div className="sf-actions">
              <Link href="/account/signin" className="sf-btn">
                Sign in
              </Link>
              <Link href="/account/signup" className="sf-btn sf-btn--quiet">
                Create account
              </Link>
            </div>
          </section>
        )}
        {user ? (
          <section className="sf-section" aria-labelledby="sf-rewards-title">
            <h2 id="sf-rewards-title" className="sf-section__title">
              Rewards
            </h2>
            {accounts.length ? (
              <ul className="sf-stack">
                {accounts.map((account) => (
                  <li className="sf-card sf-reward" key={account.id}>
                    <div className="sf-card__head">
                      <h3>{account.program?.name ?? "Rewards"}</h3>
                      <span className="sf-state">
                        <span className="sf-dot" data-tone={account.status === "active" ? "ok" : "warn"} aria-hidden="true" />
                        {account.status === "active" ? "Active" : "Paused"}
                      </span>
                      <span className="sf-muted sf-num">{account.accountNumber}</span>
                    </div>
                    <p className="sf-reward__balance">
                      <span className="sf-figure sf-num">{account.pointsBalance ?? 0}</span> points
                    </p>
                    {account.program ? (
                      <p className="sf-muted">
                        <span className="sf-num">{account.program.redemptionPoints}</span> points ={" "}
                        <span className="sf-num">{money(account.program.redemptionValueCents, account.currencyCode)}</span>
                      </p>
                    ) : null}
                    {account.entries.length ? (
                      <ul className="sf-lines">
                        {account.entries.map((entry, index) => (
                          <li key={index}>
                            <span>
                              {statusLabel(entry.type)}
                              {entry.occurredAt ? (
                                <span className="sf-muted"> · {new Date(entry.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                              ) : null}
                            </span>
                            <span className="sf-num">
                              {entry.pointsDelta > 0 ? "+" : ""}
                              {entry.pointsDelta}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sf-empty">
                <span className="sf-dot" data-tone="muted" aria-hidden="true" />
                No rewards account linked
              </p>
            )}
          </section>
        ) : null}
        <section className="sf-section" id="receipts" aria-labelledby="sf-orders-title">
          <h2 id="sf-orders-title" className="sf-section__title">
            Receipts {orders.length ? <span className="sf-listhead__count sf-num">{orders.length}</span> : null}
          </h2>
          {orders.length ? (
            <ul className="sf-orders">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link className="sf-order" href={`/account/receipts/${order.id}`}>
                    <span className="sf-order__main">
                      <span className="sf-order__no sf-num">{order.receiptNumber}</span>
                      <span className="sf-muted">
                        {itemCount(order.lines.length)}
                        {order.completedAt ? ` · ${shortDate(order.completedAt)}` : ""}
                      </span>
                    </span>
                    <span className="sf-state">
                      <span className="sf-dot" data-tone={orderTone(order.status)} aria-hidden="true" />
                      {statusLabel(order.status)}
                    </span>
                    <span className="sf-order__total sf-num">{money(order.totalCents, order.currencyCode)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sf-empty">
              <span className="sf-dot" data-tone="muted" aria-hidden="true" />
              {user ? "No receipts yet" : "Sign in to view receipts from counter purchases"}
            </p>
          )}
        </section>
      </div>
    </ShopShell>
  );
}

export async function ReceiptPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const user = await currentCustomer();
  if (!user) redirect("/account/signin");
  const [order] = await history(saleId);
  if (!order) notFound();
  return (
    <ShopShell showCategories={false}>
      <div className="sf-page">
        <Link href="/account" className="sf-back">
          <ArrowLeft aria-hidden="true" className="sf-icon" />
          Account
        </Link>
        <PageHead title={<span className="sf-num">{order.receiptNumber}</span>}>
          <span className="sf-state">
            <span className="sf-dot" data-tone={orderTone(order.status)} aria-hidden="true" />
            {statusLabel(order.status)}
          </span>
        </PageHead>
        <section className="sf-card sf-receipt" aria-label="Receipt">
          <ul className="sf-lines">
            {order.lines.map((line, index) => (
              <li key={index}>
                <span>
                  <span className="sf-num sf-muted">{quantityLabel(line.quantity)}×</span> {line.titleSnapshot}
                  {line.variantTitleSnapshot ? <span className="sf-muted"> · {line.variantTitleSnapshot}</span> : null}
                </span>
                <span className="sf-num">{money(line.totalCents, order.currencyCode)}</span>
              </li>
            ))}
          </ul>
          <dl className="sf-receipt__total">
            <dt>Total</dt>
            <dd className="sf-figure sf-num">{money(order.totalCents, order.currencyCode)}</dd>
          </dl>
          {order.completedAt ? (
            <p className="sf-muted sf-receipt__when">
              {new Date(order.completedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          ) : null}
        </section>
      </div>
    </ShopShell>
  );
}

export async function AccountAuthPage({ params, searchParams }: { params: Promise<{ mode: string }>; searchParams: Search }) {
  const [{ mode }, search] = await Promise.all([params, searchParams]);
  if (!["signin", "signup"].includes(mode)) notFound();
  if (await currentCustomer()) redirect("/account");
  const signup = mode === "signup";
  return (
    <ShopShell showCategories={false}>
      <section className="sf-auth">
        <nav className="sf-switch" aria-label="Account">
          <Link href="/account/signin" aria-current={!signup ? "page" : undefined}>
            Sign in
          </Link>
          <Link href="/account/signup" aria-current={signup ? "page" : undefined}>
            Create account
          </Link>
        </nav>
        <h1 className="sf-listhead__title">{signup ? "Create account" : "Sign in"}</h1>
        <Alert message={errorMessage(search.error)} />
        {signup && search.error === "signup" ? (
          <p className="sf-muted">
            Already have an account?{" "}
            <Link href="/account/signin" className="sf-link">
              Sign in
            </Link>
          </p>
        ) : null}
        <form className="sf-card sf-form" action={customerAuth}>
          <input type="hidden" name="mode" value={mode} />
          {signup ? (
            <label className="sf-field">
              <span>Name</span>
              <input name="name" autoComplete="name" maxLength={100} required />
            </label>
          ) : null}
          <label className="sf-field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="sf-field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={10}
              maxLength={1000}
              required
            />
          </label>
          <button className="sf-btn sf-btn--wide sf-btn--big">{signup ? "Create account" : "Sign in"}</button>
        </form>
      </section>
    </ShopShell>
  );
}
