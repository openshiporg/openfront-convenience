import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { ShopShell } from "../components/ShopShell";
import { Price } from "../components/Price";
import { catalog, customer, history, money, rewards } from "../lib/data";
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

export async function ShopPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const query = (search.q ?? "").slice(0, 100);
  const category = search.category ?? "";
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const data = await catalog({ search: query || undefined, category: category || undefined, page });
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
  return (
    <ShopShell>
      <div className="sf-pagehead">
        <div className="sf-titleline">
          <h1 className="sf-display sf-display--page">{category || "Shop"}</h1>
          {data ? <span className="sf-count">{itemCount(data.total)}</span> : null}
        </div>
        <form className="sf-search sf-search--page" method="get" role="search">
          <label htmlFor="sf-shop-search" className="sf-sr">
            Search products
          </label>
          {category ? <input type="hidden" name="category" value={category} /> : null}
          <input id="sf-shop-search" type="search" name="q" defaultValue={query} maxLength={100} placeholder="Search products" />
          <button className="sf-btn sf-btn--small">Search</button>
        </form>
      </div>
      {data?.categories.length ? (
        <nav className="sf-track sf-track--scroll" aria-label="Categories">
          <Link href={allHref} className="sf-pill" aria-current={!category ? "page" : undefined}>
            All
          </Link>
          {data.categories.map((name) => (
            <Link key={name} href={href({ category: name, page: 1 })} className="sf-pill" aria-current={name === category ? "page" : undefined}>
              {name}
            </Link>
          ))}
        </nav>
      ) : null}
      {query ? (
        <p className="sf-filterline">
          Results for <strong>{query}</strong>
          <Link href={category ? `/shop?${new URLSearchParams({ category })}` : "/shop"} className="sf-link">
            Clear
          </Link>
        </p>
      ) : null}
      {products.length ? (
        <ul className="sf-grid">
          {products.map((product) => {
            const prices = product.variants.map((variant) => variant.priceCents);
            const from = Math.min(...prices);
            const varies = prices.length > 1 && Math.max(...prices) !== from;
            const unit = product.variants.length === 1 ? product.variants[0].unitOfMeasure : "";
            return (
              <li key={product.id}>
                <Link href={`/shop/${product.id}`} className="sf-tag">
                  <span className="sf-tag__category">{product.category}</span>
                  <span className="sf-tag__title">{product.title}</span>
                  <span className="sf-tag__foot">
                    <span className="sf-tag__meta">
                      {product.variants.length > 1 ? `${product.variants.length} options` : unit && unit !== "each" ? unit : ""}
                    </span>
                    <Price cents={from} currency={data!.currency} from={varies} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p role="status" className="sf-empty">
          <span className="sf-dot" data-tone="muted" aria-hidden="true" />
          No products found
        </p>
      )}
      {pages > 1 ? (
        <nav className="sf-pager" aria-label="Pages">
          <div className="sf-track">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className="sf-pill" aria-label="Previous page">
                <ArrowLeft aria-hidden="true" className="sf-icon" />
              </Link>
            ) : null}
            <span className="sf-pill" aria-current="page">
              <span className="sf-mono">
                {page} / {pages}
              </span>
            </span>
            {page < pages ? (
              <Link href={href({ page: page + 1 })} className="sf-pill" aria-label="Next page">
                <ArrowRight aria-hidden="true" className="sf-icon" />
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </ShopShell>
  );
}

export async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const data = await catalog({ productId });
  const product = data?.products[0];
  if (!product || !data) notFound();
  const single = product.variants.length === 1 ? product.variants[0] : null;
  const prices = product.variants.map((variant) => variant.priceCents);
  const from = Math.min(...prices);
  const varies = prices.length > 1 && Math.max(...prices) !== from;
  return (
    <ShopShell>
      <Link href={`/shop?${new URLSearchParams({ category: product.category })}`} className="sf-back">
        <ArrowLeft aria-hidden="true" className="sf-icon" />
        {product.category}
      </Link>
      <section className="sf-product">
        <div className="sf-product__tag">
          <span className="sf-tag__category" aria-hidden="true">{product.category}</span>
          <span className="sf-product__tagtitle" aria-hidden="true">{product.title}</span>
          <span className="sf-product__tagfoot">
            <span className="sf-tag__meta">{single && single.unitOfMeasure !== "each" ? single.unitOfMeasure : ""}</span>
            <Price cents={from} currency={data.currency} from={varies} className="sf-price--hero" />
          </span>
        </div>
        <div className="sf-product__body">
          <p className="sf-eyebrow">{product.category}</p>
          <h1 className="sf-display sf-display--product">{product.title}</h1>
          {product.description ? <p className="sf-product__description">{product.description}</p> : null}
          <p className="sf-state sf-product__state">
            <span className="sf-dot" data-tone="ok" aria-hidden="true" />
            In store
          </p>
          {single ? null : (
            <ul className="sf-options sf-product__form" aria-label="Options">
              {product.variants.map((variant) => (
                <li key={variant.id} className="sf-option sf-option--static">
                  <span className="sf-option__title">{variant.title}</span>
                  <span className="sf-option__price">{money(variant.priceCents, data.currency)}</span>
                </li>
              ))}
            </ul>
          )}
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

export async function AccountPage() {
  const user = await customer();
  const [orders, accounts] = user ? await Promise.all([history(), rewards()]) : [[], []];
  return (
    <ShopShell>
      <div className="sf-pagehead">
        <h1 className="sf-display sf-display--page">Account</h1>
      </div>
      {user ? (
        <section className="sf-profile" aria-label="Profile">
          <div>
            <p className="sf-profile__name">{user.name}</p>
            <p className="sf-muted">{user.email}</p>
          </div>
          <form action={customerSignout}>
            <button className="sf-btn sf-btn--quiet">Sign out</button>
          </form>
        </section>
      ) : (
        <section className="sf-profile" aria-label="Sign in">
          <p className="sf-empty">
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
        <section className="sf-section sf-section--tight" aria-labelledby="sf-rewards-title">
          <div className="sf-section__head">
            <h2 id="sf-rewards-title">Rewards</h2>
          </div>
          {accounts.length ? (
            <ul className="sf-band">
              {accounts.map((account) => (
                <li className="sf-order" key={account.id}>
                  <div className="sf-titleline">
                    <h3>{account.program?.name ?? "Rewards"}</h3>
                    <span className="sf-state">
                      <span className="sf-dot" data-tone={account.status === "active" ? "ok" : "warn"} aria-hidden="true" />
                      {account.status === "active" ? "Active" : "Paused"}
                    </span>
                    <span className="sf-muted sf-mono">{account.accountNumber}</span>
                  </div>
                  <p className="sf-rewards__balance">
                    <span className="sf-mono">{account.pointsBalance ?? 0}</span> points
                  </p>
                  {account.program ? (
                    <p className="sf-muted">
                      {account.program.redemptionPoints} points = {money(account.program.redemptionValueCents, account.currencyCode)}
                    </p>
                  ) : null}
                  {account.entries.length ? (
                    <ul className="sf-order__lines">
                      {account.entries.map((entry, index) => (
                        <li key={index}>
                          <span>
                            {statusLabel(entry.type)}
                            {entry.occurredAt ? (
                              <span className="sf-muted"> · {new Date(entry.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                            ) : null}
                          </span>
                          <span className="sf-mono">
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
      <section className="sf-section sf-section--tight" aria-labelledby="sf-orders-title">
        <div className="sf-section__head">
          <h2 id="sf-orders-title">Receipts</h2>
          {orders.length ? <span className="sf-count">{orders.length}</span> : null}
        </div>
        {orders.length ? (
          <ul className="sf-band">
            {orders.map((order) => (
              <li key={order.id}>
                <Link className="sf-order sf-order--link" href={`/account/receipts/${order.id}`}>
                  <div className="sf-titleline">
                    <h3 className="sf-mono">{order.receiptNumber}</h3>
                    <span className="sf-state">
                      <span className="sf-dot" data-tone={orderTone(order.status)} aria-hidden="true" />
                      {statusLabel(order.status)}
                    </span>
                    {order.completedAt ? (
                      <time className="sf-muted" dateTime={order.completedAt}>
                        {new Date(order.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </time>
                    ) : null}
                  </div>
                  <p className="sf-order__total">
                    <span>
                      {order.lines.length} {order.lines.length === 1 ? "item" : "items"}
                    </span>
                    <span className="sf-mono">{money(order.totalCents, order.currencyCode)}</span>
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
          <h1 className="sf-display sf-display--page sf-mono">{order.receiptNumber}</h1>
          <span className="sf-state">
            <span className="sf-dot" data-tone={orderTone(order.status)} aria-hidden="true" />
            {statusLabel(order.status)}
          </span>
        </div>
      </div>
      <aside className="sf-tape sf-tape--receipt" aria-label="Receipt">
        <ul className="sf-tape__lines">
          {order.lines.map((line, index) => (
            <li key={index}>
              <span>
                <span className="sf-mono sf-muted">{quantityLabel(line.quantity)}×</span> {line.titleSnapshot}
                {line.variantTitleSnapshot ? <span className="sf-muted"> · {line.variantTitleSnapshot}</span> : null}
              </span>
              <span className="sf-mono">{money(line.totalCents, order.currencyCode)}</span>
            </li>
          ))}
        </ul>
        <dl>
          <div className="sf-tape__total">
            <dt>Total</dt>
            <dd>{money(order.totalCents, order.currencyCode)}</dd>
          </div>
        </dl>
        {order.completedAt ? (
          <p className="sf-muted sf-tape__more">
            {new Date(order.completedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : null}
      </aside>
    </ShopShell>
  );
}

export async function AccountAuthPage({ params, searchParams }: { params: Promise<{ mode: string }>; searchParams: Search }) {
  const [{ mode }, search] = await Promise.all([params, searchParams]);
  if (!["signin", "signup"].includes(mode)) notFound();
  const signup = mode === "signup";
  return (
    <ShopShell>
      <section className="sf-auth">
        <nav className="sf-track" aria-label="Account">
          <Link href="/account/signin" className="sf-pill" aria-current={!signup ? "page" : undefined}>
            Sign in
          </Link>
          <Link href="/account/signup" className="sf-pill" aria-current={signup ? "page" : undefined}>
            Create account
          </Link>
        </nav>
        <h1 className="sf-display sf-display--page">{signup ? "Create account" : "Sign in"}</h1>
        <Alert message={errorMessage(search.error)} />
        {signup && search.error === "signup" ? (
          <p className="sf-filterline">
            Already have an account?
            <Link href="/account/signin" className="sf-link">
              Sign in
            </Link>
          </p>
        ) : null}
        <form className="sf-form sf-card" action={customerAuth}>
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
