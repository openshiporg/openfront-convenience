// Load every staff and storefront page as the demo admin; print PASS/FAIL per page.
// Usage: CRAWL_BASE=http://localhost:4871 CRAWL_EMAIL=.. CRAWL_PASSWORD=.. node scripts/r6-crawl.mjs
import { chromium } from '/Users/junaid/Code/vibeghost/vibeghost/node_modules/playwright/index.mjs'
const BASE = process.env.CRAWL_BASE
const gql = async (query, cookie) => (await fetch(BASE + '/api/graphql', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ query }) })).json()
const login = await gql(`mutation{authenticateUserWithPassword(email:${JSON.stringify(process.env.CRAWL_EMAIL)},password:${JSON.stringify(process.env.CRAWL_PASSWORD)}){... on UserAuthenticationWithPasswordSuccess{sessionToken}}}`)
const tok = login.data?.authenticateUserWithPassword?.sessionToken
if (!tok) { console.log('CHECK login: FAIL'); process.exit(1) }
const cookie = 'keystonejs-session=' + tok
const sections = ['', 'pos', 'store-settings', 'sales', 'customers', 'reconciliation', 'fuel', 'vendors', 'payments', 'products', 'purchase-orders', 'purchasing', 'recovery', 'foodservice', 'loyalty', 'exceptions', 'exports', 'restricted-sales', 'tills', 'promotions', 'inventory', 'money-services', 'staff', 'stock', 'pricing', 'lottery', 'reports']
const ids = (await gql('{products(take:1){id} sales(take:1){id}}', cookie)).data ?? {}
const staff = sections.map(s => '/dashboard/platform' + (s ? '/' + s : ''))
const shop = ['/', '/shop', '/basket', '/checkout', '/account', '/account/signin', ids.products?.[0] && '/shop/' + ids.products[0].id, '/shop/nope123'].filter(Boolean)
const b = await chromium.launch({ executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium_headless_shell-1254/chrome-headless-shell-mac-arm64/chrome-headless-shell' })
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })
const p = await ctx.newPage()
await p.goto(BASE + '/dashboard/signin')
await p.fill('input[name=email]', process.env.CRAWL_EMAIL); await p.fill('input[name=password]', process.env.CRAWL_PASSWORD)
await Promise.all([p.waitForURL(u => !u.pathname.includes('signin'), { timeout: 30000 }), p.click('button[type=submit]')])
let bad = 0, n = 0
const paths = [...staff, ...staff.slice(1).filter(x => /products|sales|customers|vendors|purchase-orders/.test(x)).map(x => x + '/nope123'), ...shop]
for (const path of paths) {
  const r = await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null)
  const txt = await p.evaluate(() => document.body.innerText).catch(() => '')
  const http = r?.status() ?? 0
  const want404 = path.includes('nope123')
  const broken = /application error|something went wrong|this page could not be loaded|QUERY_TOO_BROAD/i.test(txt)
  const ok = want404 ? http === 404 : http === 200 && !broken
  n++; if (!ok) bad++
  console.log(`CHECK ${path}: ${ok ? 'PASS' : 'FAIL'} (${http}${want404 ? ' expected 404' : ''})`)
}
await b.close()
console.log(`CHECK all pages: ${bad ? 'FAIL' : 'PASS'} (${n - bad}/${n})`)
