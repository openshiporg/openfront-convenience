import Link from "next/link";
import { notFound } from "next/navigation";
import { ShopShell } from "../components/ShopShell";
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
export async function ShopPage({ searchParams }: { searchParams: Search }) {
  const search = await searchParams;
  const query = (search.q ?? "").slice(0, 100);
  const category = search.category ?? "";
  const page = Math.max(1, Number.parseInt(search.page ?? "1", 10) || 1);
  const data = await catalog({ search: query || undefined, category: category || undefined, page });
  const products = data?.products ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const pageHref = (target: number) => `/shop?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(category ? { category } : {}), page: String(target) })}`;
  return <ShopShell><h1>Shop</h1>
    <form className="shop-search" method="get"><label>Search products<input type="search" name="q" defaultValue={query} maxLength={100} /></label><label>Category<select name="category" defaultValue={category}><option value="">All categories</option>{data?.categories.map(name => <option key={name}>{name}</option>)}</select></label><button>Search</button>{(query || category) && <Link href="/shop">Clear filters</Link>}</form>
    <div className="shop-grid">{products.map(product => { const prices = product.variants.map(x => x.priceCents); const from = Math.min(...prices); return <article key={product.id} className="shop-card"><p className="shop-label">{product.category}</p><h2><Link href={`/shop/${product.id}`}>{product.title}</Link></h2><p>{prices.length > 1 && Math.max(...prices) !== from ? "From " : ""}{money(from, data!.currency)}</p><Link href={`/shop/${product.id}`}>View product</Link></article>; })}</div>
    {!products.length && <p role="status">No products found</p>}
    {pages > 1 && <nav className="shop-account-nav" aria-label="Pages">{page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link href={pageHref(page + 1)}>Next</Link>}</nav>}
  </ShopShell>;
}

export async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const data = await catalog({ productId });
  const product = data?.products[0];
  if (!product || !data) notFound();
  const single = product.variants.length === 1 ? product.variants[0] : null;
  return <ShopShell><Link href="/shop">Back to shop</Link><section className="shop-detail"><p className="shop-label">{product.category}</p><h1>{product.title}</h1>{product.description && <p>{product.description}</p>}{single && <p>{money(single.priceCents, data.currency)}</p>}<form action={changeBasket} className="shop-form">{single ? <input type="hidden" name="variantId" value={single.id} /> : <label>Option<select name="variantId">{product.variants.map(variant => <option key={variant.id} value={variant.id}>{variant.title} · {money(variant.priceCents, data.currency)}</option>)}</select></label>}<label>Quantity<input name="quantity" type="number" min="1" max="99" defaultValue="1" required /></label><button>Add to basket</button></form></section></ShopShell>;
}

export async function BasketPage({ searchParams }: { searchParams: Search }) {
  const [cart, search] = await Promise.all([basket(), searchParams]);
  return <ShopShell><h1>Basket</h1>{errorMessage(search.error) && <p role="alert">{errorMessage(search.error)}</p>}
    {cart?.lines.length ? <><div className="shop-stack">{cart.lines.map(line => <article key={line.id} className="shop-basket-line"><div><h2>{line.titleSnapshot}</h2><p>{line.variantTitleSnapshot}</p><p>{money(line.totalCents, cart.currencyCode)}</p></div><form action={changeBasket}><input type="hidden" name="lineId" value={line.id} /><label>Quantity<input type="number" name="quantity" min="0" max="99" defaultValue={Number(line.quantity)} required /></label><button>Update</button></form><form action={changeBasket}><input type="hidden" name="lineId" value={line.id} /><input type="hidden" name="quantity" value="0" /><button aria-label={`Remove ${line.titleSnapshot}`}>Remove</button></form></article>)}</div><dl className="shop-totals"><div><dt>Subtotal</dt><dd>{money(cart.subtotalCents, cart.currencyCode)}</dd></div><div><dt>Tax</dt><dd>{money(cart.taxCents, cart.currencyCode)}</dd></div><div><dt>Total</dt><dd>{money(cart.totalCents, cart.currencyCode)}</dd></div></dl><Link className="shop-primary" href="/checkout">Continue to checkout</Link></> : <><p>Your basket is empty</p><Link className="shop-primary" href="/shop">Shop</Link></>}
  </ShopShell>;
}

export async function CheckoutPage() {
  const [cart, user] = await Promise.all([basket(), customer()]);
  return <ShopShell><h1>Checkout</h1>{cart?.lines.length ? <section className="shop-stack"><h2>Order review</h2>{cart.lines.map(x => <p key={x.id}>{x.titleSnapshot} · {Number(x.quantity)} · {money(x.totalCents, cart.currencyCode)}</p>)}<strong>Total {money(cart.totalCents, cart.currencyCode)}</strong>{user ? <p>{user.name}</p> : <Link href="/account/signin">Sign in</Link>}<h2>Payment</h2><p role="status">Online payment unavailable</p><button disabled aria-disabled="true">Pay {money(cart.totalCents, cart.currencyCode)}</button><Link href="/basket">Back to basket</Link></section> : <><p>Your basket is empty</p><Link href="/shop">Shop</Link></>}</ShopShell>;
}

export async function AccountPage() {
  const user = await customer();
  const orders = await history();
  return <ShopShell><h1>Account</h1>{user ? <><p>{user.name}</p><p>{user.email}</p><form action={customerSignout}><button>Sign out</button></form></> : <nav className="shop-account-nav"><Link href="/account/signin">Sign in</Link><Link href="/account/signup">Create account</Link></nav>}<h2>Order history</h2>{orders.length ? <div className="shop-stack">{orders.map(order => <article className="shop-card" key={order.id}><h3><span className="shop-status-dot" />{order.receiptNumber} · {order.status.replaceAll("_", " ")}</h3>{order.lines.map((line, i) => <p key={i}>{line.titleSnapshot} · {line.variantTitleSnapshot} · {Number(line.quantity)} · {money(line.totalCents, order.currencyCode)}</p>)}<strong>{money(order.totalCents, order.currencyCode)}</strong></article>)}</div> : <p>{user ? "No orders yet" : "Sign in to view your orders"}</p>}</ShopShell>;
}

export async function AccountAuthPage({ params, searchParams }: { params: Promise<{ mode: string }>; searchParams: Search }) {
  const [{ mode }, search] = await Promise.all([params, searchParams]);
  if (!["signin", "signup"].includes(mode)) notFound();
  const signup = mode === "signup";
  return <ShopShell><h1>{signup ? "Create account" : "Sign in"}</h1>{errorMessage(search.error) && <p role="alert">{errorMessage(search.error)}</p>}<form className="shop-form" action={customerAuth}><input type="hidden" name="mode" value={mode} />{signup && <label>Name<input name="name" autoComplete="name" maxLength={100} required /></label>}<label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={10} maxLength={1000} required /></label><button>{signup ? "Create account" : "Sign in"}</button><Link href={signup ? "/account/signin" : "/account/signup"}>{signup ? "Sign in" : "Create account"}</Link></form></ShopShell>;
}
