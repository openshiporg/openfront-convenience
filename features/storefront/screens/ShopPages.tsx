import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Search as SearchIcon } from "lucide-react";

import { ShopShell } from "../components/ShopShell";
import { Price } from "../components/Price";
import { AisleHead, AisleSigns, numberAisles } from "../components/AisleSigns";
import { AskTag, ShelfTag, priceOf, variantSize } from "../components/ShelfTag";
import { catalog, customer, history, money, rewards, type Catalog } from "../lib/data";
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

type Search = Promise<{ q?: string; category?: string; page?: string; error?: string }>;
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

type Product = Catalog["products"][number];

export async function ShopPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const query = (search.q ?? "").slice(0, 100);
  const category = search.category ?? "";
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const [data, projection] = await Promise.all([
    catalog({ search: query || undefined, category: category || undefined, page }),
    getPublicStorefrontProjection(),
  ]);
  const products = data?.products ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const href = (next: { category?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const nextCategory = next.category ?? category;
    if (nextCategory) params.set("category", nextCategory);
    if (next.page && next.page > 1) params.set("page", String(next.page));
    const value = params.toString();
    return value ? `/shop?${value}` : "/shop";
  };
  const allHref = query ? `/shop?${new URLSearchParams({ q: query })}` : "/shop";
  const aisles = numberAisles(data?.categories ?? []);
  const aisleOf = (name: string) => aisles.find((aisle) => aisle.name === name) ?? null;
  // This page of results, shelved by aisle in the store's aisle order.
  const shelves = new Map<string, Product[]>();
  for (const product of products) shelves.set(product.category, [...(shelves.get(product.category) ?? []), product]);
  const ordered = [...shelves.entries()].sort(
    ([a], [b]) => (aisleOf(a)?.number ?? Number.MAX_SAFE_INTEGER) - (aisleOf(b)?.number ?? Number.MAX_SAFE_INTEGER) || a.localeCompare(b),
  );
  const madeInStore = new Set(projection.categories.flatMap((entry) => entry.products.filter((product) => product.preparedFood).map((product) => product.id)));
  const current = aisleOf(category);
  return (
    <ShopShell>
      <div className="sf-pagehead">
        <div className="sf-titleline">
          <h1 className="sf-title">
            {current ? (
              <span className="sf-title__no">
                <span className="sf-sr">Aisle </span>
                {current.number}
              </span>
            ) : null}
            {category || "Shop"}
          </h1>
          {data ? <span className="sf-count">{itemCount(data.total)}</span> : null}
        </div>
        <form className="sf-searchline sf-searchline--page" method="get" role="search">
          <label htmlFor="sf-shop-search" className="sf-sr">
            Search products
          </label>
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <SearchIcon aria-hidden="true" className="sf-icon sf-searchline__icon" />
          <input id="sf-shop-search" type="search" name="q" defaultValue={query} maxLength={100} placeholder="Search products" />
          <button className="sf-btn">Search</button>
        </form>
      </div>
      {aisles.length ? <AisleSigns aisles={aisles} current={category || null} allHref={allHref} hrefFor={(name) => href({ category: name, page: 1 })} /> : null}
      {query ? (
        <p className="sf-filterline">
          Results for <strong>{query}</strong>
          <Link href={category ? `/shop?${new URLSearchParams({ category })}` : "/shop"} className="sf-link">
            Clear
          </Link>
        </p>
      ) : null}
      {ordered.length ? (
        ordered.map(([name, items], index) => {
          const id = `sf-aisle-${index}`;
          return (
            <section key={name} className="sf-shelf" aria-labelledby={id}>
              <AisleHead aisle={aisleOf(name)} name={name} id={id}>
                {!category && aisleOf(name) ? (
                  <Link href={href({ category: name, page: 1 })} className="sf-more">
                    View aisle
                    <ArrowRight aria-hidden="true" className="sf-icon" />
                  </Link>
                ) : null}
              </AisleHead>
              <ul className="sf-tags">
                {items.map((product) => (
                  <li key={product.id}>
                    <ShelfTag product={product} currency={data!.currency} madeInStore={madeInStore.has(product.id)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
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
    </ShopShell>
  );
}

const stockLabel = { in_stock: { tone: "ok", label: "In stock" }, ask: { tone: "muted", label: "Ask at counter" } } as const;

export async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const data = await catalog({ productId });
  const product = data?.products[0];
  if (!product || !data) notFound();
  const aisle = numberAisles(data.categories).find((entry) => entry.name === product.category) ?? null;
  const single = product.variants.length === 1;
  return (
    <ShopShell>
      <Link href={`/shop?${new URLSearchParams({ category: product.category })}`} className="sf-back">
        <ArrowLeft aria-hidden="true" className="sf-icon" />
        {aisle ? <span className="sf-back__no">{aisle.number}</span> : null}
        {product.category}
      </Link>
      <section className="sf-product" data-photo={product.image ? "" : undefined}>
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed bucket URL, shown as uploaded
          <img className="sf-product__photo" src={product.image.url} alt={product.image.alt || product.title} />
        ) : null}
        <div className="sf-product__body">
          <h1 className="sf-title sf-title--product">{product.title}</h1>
          {product.description ? <p className="sf-product__description">{product.description}</p> : null}
          <ul className="sf-sizes" aria-label={single ? "Price" : "Sizes"} data-single={single || undefined}>
            {product.variants.map((variant) => {
              const price = priceOf([variant]);
              const size = variantSize(variant, product.title) || (single ? "" : variant.title);
              const stock = price && variant.availability !== "untracked" ? stockLabel[variant.availability] : null;
              return (
                <li key={variant.id} className="sf-tag sf-tag--size" data-variant={price ? undefined : "ask"}>
                  {size ? <span className="sf-tag__name">{size}</span> : null}
                  {price ? <Price cents={price.from} currency={data.currency} /> : <AskTag />}
                  {stock ? (
                    <span className="sf-tag__stock">
                      <span className="sf-dot" data-tone={stock.tone} aria-hidden="true" />
                      {stock.label}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </ShopShell>
  );
}

// The storefront is a catalog: orders are paid at the counter, and there is no
// online payment provider, so the basket and checkout routes lead back to the shop.
export async function BasketPage() {
  redirect("/shop");
}

export async function CheckoutPage() {
  redirect("/shop");
}

const shortDate = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export async function AccountPage() {
  const user = await customer();
  const [orders, accounts] = user ? await Promise.all([history(), rewards()]) : [[], []];
  return (
    <ShopShell>
      <div className="sf-pagehead">
        <h1 className="sf-title">Account</h1>
      </div>
      <div className="sf-account">
        {user ? (
          <section className="sf-panel sf-profile" aria-label="Profile">
            <div>
              <p className="sf-profile__name">{user.name}</p>
              <p className="sf-panel__muted">{user.email}</p>
            </div>
            <form action={customerSignout}>
              <button className="sf-btn sf-btn--quiet">Sign out</button>
            </form>
          </section>
        ) : (
          <section className="sf-panel sf-profile" aria-label="Sign in">
            <p className="sf-state">
              <span className="sf-dot" data-tone="muted" aria-hidden="true" />
              Signed out
            </p>
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
            <div className="sf-section__head">
              <h2 id="sf-rewards-title" className="sf-plate">
                <span className="sf-plate__name">Rewards</span>
              </h2>
            </div>
            {accounts.length ? (
              <ul className="sf-stack">
                {accounts.map((account) => (
                  <li className="sf-panel sf-reward" key={account.id}>
                    <div className="sf-panel__head">
                      <h3>{account.program?.name ?? "Rewards"}</h3>
                      <span className="sf-state">
                        <span className="sf-dot" data-tone={account.status === "active" ? "ok" : "warn"} aria-hidden="true" />
                        {account.status === "active" ? "Active" : "Paused"}
                      </span>
                      <span className="sf-panel__muted sf-num">{account.accountNumber}</span>
                    </div>
                    <p className="sf-reward__balance">
                      <span className="sf-figure">{account.pointsBalance ?? 0}</span> points
                    </p>
                    {account.program ? (
                      <p className="sf-panel__muted">
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
                                <span className="sf-panel__muted"> · {new Date(entry.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
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
        <section className="sf-section" aria-labelledby="sf-orders-title">
          <div className="sf-section__head">
            <h2 id="sf-orders-title" className="sf-plate">
              <span className="sf-plate__name">Receipts</span>
            </h2>
            {orders.length ? <span className="sf-count">{orders.length}</span> : null}
          </div>
          {orders.length ? (
            <ul className="sf-stack">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link className="sf-panel sf-order" href={`/account/receipts/${order.id}`}>
                    <div className="sf-panel__head">
                      <h3 className="sf-num">{order.receiptNumber}</h3>
                      <span className="sf-state">
                        <span className="sf-dot" data-tone={orderTone(order.status)} aria-hidden="true" />
                        {statusLabel(order.status)}
                      </span>
                      {order.completedAt ? (
                        <time className="sf-panel__muted" dateTime={order.completedAt}>
                          {shortDate(order.completedAt)}
                        </time>
                      ) : null}
                    </div>
                    <p className="sf-order__total">
                      <span>{itemCount(order.lines.length)}</span>
                      <span className="sf-figure">{money(order.totalCents, order.currencyCode)}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sf-empty">
              <span className="sf-dot" data-tone="muted" aria-hidden="true" />
              {user ? "No receipts yet" : "Sign in to view your receipts"}
            </p>
          )}
        </section>
      </div>
    </ShopShell>
  );
}

export async function ReceiptPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = await params;
  const user = await customer();
  if (!user) redirect("/account/signin");
  const [order] = await history(saleId);
  if (!order) notFound();
  return (
    <ShopShell>
      <Link href="/account" className="sf-back">
        <ArrowLeft aria-hidden="true" className="sf-icon" />
        Account
      </Link>
      <div className="sf-pagehead">
        <div className="sf-titleline">
          <h1 className="sf-title sf-num">{order.receiptNumber}</h1>
          <span className="sf-state">
            <span className="sf-dot" data-tone={orderTone(order.status)} aria-hidden="true" />
            {statusLabel(order.status)}
          </span>
        </div>
      </div>
      <section className="sf-panel sf-receipt" aria-label="Receipt">
        <ul className="sf-lines">
          {order.lines.map((line, index) => (
            <li key={index}>
              <span>
                <span className="sf-num sf-panel__muted">{quantityLabel(line.quantity)}×</span> {line.titleSnapshot}
                {line.variantTitleSnapshot ? <span className="sf-panel__muted"> · {line.variantTitleSnapshot}</span> : null}
              </span>
              <span className="sf-num">{money(line.totalCents, order.currencyCode)}</span>
            </li>
          ))}
        </ul>
        <dl className="sf-receipt__total">
          <dt>Total</dt>
          <dd className="sf-figure">{money(order.totalCents, order.currencyCode)}</dd>
        </dl>
        {order.completedAt ? (
          <p className="sf-panel__muted sf-receipt__when">
            {new Date(order.completedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : null}
      </section>
    </ShopShell>
  );
}

export async function AccountAuthPage({ params, searchParams }: { params: Promise<{ mode: string }>; searchParams: Search }) {
  const [{ mode }, search] = await Promise.all([params, searchParams]);
  if (!["signin", "signup"].includes(mode)) notFound();
  if (await customer()) redirect("/account");
  const signup = mode === "signup";
  return (
    <ShopShell>
      <section className="sf-auth">
        <nav className="sf-switch" aria-label="Account">
          <Link href="/account/signin" aria-current={!signup ? "page" : undefined}>
            Sign in
          </Link>
          <Link href="/account/signup" aria-current={signup ? "page" : undefined}>
            Create account
          </Link>
        </nav>
        <h1 className="sf-title">{signup ? "Create account" : "Sign in"}</h1>
        <Alert message={errorMessage(search.error)} />
        {signup && search.error === "signup" ? (
          <p className="sf-filterline">
            Already have an account?
            <Link href="/account/signin" className="sf-link">
              Sign in
            </Link>
          </p>
        ) : null}
        <form className="sf-panel sf-form" action={customerAuth}>
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
          <button className="sf-btn sf-btn--wide">{signup ? "Create account" : "Sign in"}</button>
        </form>
      </section>
    </ShopShell>
  );
}
