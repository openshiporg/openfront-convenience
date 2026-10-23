import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";

import { ShopShell } from "../components/ShopShell";
import { Price } from "../components/Price";
import { catalog, basket, customer, history, money } from "../lib/data";
import { changeBasket, customerAuth, customerSignout } from "../actions";

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
          <form action={changeBasket} className="sf-form sf-product__form">
            {single ? (
              <input type="hidden" name="variantId" value={single.id} />
            ) : (
              <fieldset className="sf-field">
                <legend>Option</legend>
                <div className="sf-options">
                  {product.variants.map((variant, index) => (
                    <label key={variant.id} className="sf-option">
                      <input type="radio" name="variantId" value={variant.id} defaultChecked={index === 0} required />
                      <span className="sf-option__title">{variant.title}</span>
                      <span className="sf-option__price">{money(variant.priceCents, data.currency)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="sf-buyrow">
              <label className="sf-field sf-qty">
                <span>Qty</span>
                <input name="quantity" type="number" inputMode="numeric" min="1" max="99" defaultValue="1" required />
              </label>
              <button className="sf-btn sf-btn--signal sf-btn--wide">Add to basket</button>
            </div>
          </form>
        </div>
      </section>
    </ShopShell>
  );
}

export async function BasketPage({ searchParams }: { searchParams: Search }) {
  const [cart, search] = await Promise.all([basket(), searchParams]);
  const count = Math.round((cart?.lines ?? []).reduce((sum, line) => sum + Number(line.quantity || 0), 0));
  return (
    <ShopShell>
      <div className="sf-pagehead">
        <div className="sf-titleline">
          <h1 className="sf-display sf-display--page">Basket</h1>
          {cart?.lines.length ? <span className="sf-count">{itemCount(count)}</span> : null}
        </div>
      </div>
      <Alert message={errorMessage(search.error)} />
      {cart?.lines.length ? (
        <div className="sf-split">
          <ul className="sf-band" aria-label="Basket items">
            {cart.lines.map((line) => (
              <li key={line.id} className="sf-line">
                <div className="sf-line__text">
                  <p className="sf-line__title">{line.titleSnapshot}</p>
                  <p className="sf-line__meta">
                    {line.variantTitleSnapshot ? `${line.variantTitleSnapshot} · ` : ""}
                    <span className="sf-mono">{money(line.unitPriceCents, cart.currencyCode)}</span> each
                  </p>
                </div>
                <div className="sf-line__controls">
                  <form action={changeBasket} className="sf-qtyform">
                    <input type="hidden" name="lineId" value={line.id} />
                    <label className="sf-sr" htmlFor={`qty-${line.id}`}>
                      Quantity for {line.titleSnapshot}
                    </label>
                    <input
                      id={`qty-${line.id}`}
                      type="number"
                      inputMode="numeric"
                      name="quantity"
                      min="0"
                      max="99"
                      defaultValue={Number(line.quantity)}
                      required
                    />
                    <button className="sf-pill sf-pill--raised">Update</button>
                  </form>
                  <form action={changeBasket}>
                    <input type="hidden" name="lineId" value={line.id} />
                    <input type="hidden" name="quantity" value="0" />
                    <button className="sf-iconbtn" aria-label={`Remove ${line.titleSnapshot}`}>
                      <Trash2 aria-hidden="true" className="sf-icon" />
                    </button>
                  </form>
                </div>
                <p className="sf-line__total sf-mono">{money(line.totalCents, cart.currencyCode)}</p>
              </li>
            ))}
          </ul>
          <aside className="sf-tape" aria-label="Basket total">
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{money(cart.subtotalCents, cart.currencyCode)}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>{money(cart.taxCents, cart.currencyCode)}</dd>
              </div>
              <div className="sf-tape__total">
                <dt>Total</dt>
                <dd>{money(cart.totalCents, cart.currencyCode)}</dd>
              </div>
            </dl>
            <Link className="sf-btn sf-btn--signal sf-btn--wide" href="/checkout">
              Checkout
            </Link>
            <Link className="sf-link sf-tape__more" href="/shop">
              Keep shopping
            </Link>
          </aside>
          <div className="sf-stickybar">
            <span>
              <span className="sf-stickybar__label">Total</span>
              <span className="sf-mono">{money(cart.totalCents, cart.currencyCode)}</span>
            </span>
            <Link className="sf-btn sf-btn--signal" href="/checkout">
              Checkout
            </Link>
          </div>
        </div>
      ) : (
        <EmptyBasket />
      )}
    </ShopShell>
  );
}

function EmptyBasket() {
  return (
    <div className="sf-emptycard">
      <p className="sf-empty">
        <span className="sf-dot" data-tone="muted" aria-hidden="true" />
        Your basket is empty
      </p>
      <Link className="sf-btn" href="/shop">
        Shop the store
      </Link>
    </div>
  );
}

export async function CheckoutPage() {
  const [cart, user] = await Promise.all([basket(), customer()]);
  return (
    <ShopShell>
      <div className="sf-pagehead">
        <h1 className="sf-display sf-display--page">Checkout</h1>
      </div>
      {cart?.lines.length ? (
        <div className="sf-split">
          <ol className="sf-steps">
            <li className="sf-step">
              <div className="sf-titleline">
                <h2>
                  <span className="sf-step__n">1</span>Account
                </h2>
                <span className="sf-state">
                  <span className="sf-dot" data-tone={user ? "ok" : "muted"} aria-hidden="true" />
                  {user ? "Signed in" : "Guest"}
                </span>
              </div>
              {user ? (
                <p className="sf-step__body">
                  {user.name}
                  <span className="sf-muted"> · {user.email}</span>
                </p>
              ) : (
                <div className="sf-step__body sf-actions">
                  <Link href="/account/signin" className="sf-btn sf-btn--quiet">
                    Sign in
                  </Link>
                  <Link href="/account/signup" className="sf-link">
                    Create account
                  </Link>
                </div>
              )}
            </li>
            <li className="sf-step">
              <div className="sf-titleline">
                <h2>
                  <span className="sf-step__n">2</span>Payment
                </h2>
                <span className="sf-state">
                  <span className="sf-dot" data-tone="warn" aria-hidden="true" />
                  Online payment unavailable
                </span>
              </div>
              <div className="sf-step__body">
                <button className="sf-btn sf-btn--wide" disabled aria-disabled="true">
                  Pay {money(cart.totalCents, cart.currencyCode)}
                </button>
              </div>
            </li>
          </ol>
          <aside className="sf-tape" aria-label="Order summary">
            <ul className="sf-tape__lines">
              {cart.lines.map((line) => (
                <li key={line.id}>
                  <span>
                    <span className="sf-mono sf-muted">{Number(line.quantity)}×</span> {line.titleSnapshot}
                  </span>
                  <span className="sf-mono">{money(line.totalCents, cart.currencyCode)}</span>
                </li>
              ))}
            </ul>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{money(cart.subtotalCents, cart.currencyCode)}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>{money(cart.taxCents, cart.currencyCode)}</dd>
              </div>
              <div className="sf-tape__total">
                <dt>Total</dt>
                <dd>{money(cart.totalCents, cart.currencyCode)}</dd>
              </div>
            </dl>
            <Link className="sf-link sf-tape__more" href="/basket">
              Edit basket
            </Link>
          </aside>
        </div>
      ) : (
        <EmptyBasket />
      )}
    </ShopShell>
  );
}

export async function AccountPage() {
  const user = await customer();
  const orders = await history();
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
      <section className="sf-section sf-section--tight" aria-labelledby="sf-orders-title">
        <div className="sf-section__head">
          <h2 id="sf-orders-title">Orders</h2>
          {orders.length ? <span className="sf-count">{orders.length}</span> : null}
        </div>
        {orders.length ? (
          <ul className="sf-band">
            {orders.map((order) => (
              <li className="sf-order" key={order.id}>
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
                <ul className="sf-order__lines">
                  {order.lines.map((line, index) => (
                    <li key={index}>
                      <span>
                        <span className="sf-mono sf-muted">{Number(line.quantity)}×</span> {line.titleSnapshot}
                        {line.variantTitleSnapshot ? <span className="sf-muted"> · {line.variantTitleSnapshot}</span> : null}
                      </span>
                      <span className="sf-mono">{money(line.totalCents, order.currencyCode)}</span>
                    </li>
                  ))}
                </ul>
                <p className="sf-order__total">
                  <span>Total</span>
                  <span className="sf-mono">{money(order.totalCents, order.currencyCode)}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="sf-empty">
            <span className="sf-dot" data-tone="muted" aria-hidden="true" />
            {user ? "No orders yet" : "Sign in to view your orders"}
          </p>
        )}
      </section>
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
