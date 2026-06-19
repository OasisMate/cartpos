# Rich Demo Data (22 shops) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the thin `CartPOS Demo` fixture with a rich, realistic, feature-complete demo — 22 shops (one per business type), each with a trade catalog and 90 days of activity that exercises every entity/field/enum — then verify it live with Playwright.

**Architecture:** A data-driven rewrite of `scripts/seed-demo-org.ts`: a `VERTICALS[]` table (per-shop catalog + city + feature profile) feeds a generic `seedShop()` + deterministic `simulate90Days()` engine. `scripts/reset-demo-org.ts` is extended to clean up newer tables. Verification is a Playwright pass against the live demo org, using `toggle-demo-lock.ts` to test demo-blocked flows.

**Tech Stack:** TypeScript + `tsx`, Prisma 6 (`@prisma/client`), bcryptjs, Postgres (Supabase prod, scoped to `isDemo` org), Playwright MCP for UI verification.

---

## Key facts the implementer must know
- **No test runner exists.** "Tests" here = `npx tsc --noEmit` (typecheck), running the seed script, asserting DB row counts via a throwaway query script, and Playwright UI checks. Follow these as the verification steps.
- **Prisma `@default(now())` can be overridden** by passing an explicit value in `data` — this is how we backfill 90-day history (`createdAt`, `date`, `receivedAt`).
- **Decimals:** use `const D = (n:number) => new Prisma.Decimal(n)` (already in the file).
- **Determinism:** use a seeded PRNG (mulberry32), seed varied per shop index, so reseeds are reproducible. Do NOT use `Math.random` for amounts (non-reproducible demos).
- **Per-shop flags:** call `presetShopSettingsData(type)` from `src/lib/domain/business-presets.ts` so each shop's `ShopSettings` matches its trade (the org stays `GENERAL_STORE`).
- **Forced UPPERCASE product names** are intentional — author catalogs in UPPERCASE.
- **No em/en dashes** in any user-facing string (notes, descriptions). Use `.` `,` `:` or rephrase.
- **Reset is hard-guarded** to `isDemo=true` and is the intended "restore" tool. The demo org id is `cmq8k1vxn0000fc18qfv6x3ic`; logins `demo.admin|manager|cashier@cartpos.app` / `Demo@12345`.
- After `prisma generate` / pulling client changes, **restart `npm run dev`** (server caches the client).

## File structure
- **Modify (full rewrite of data + helpers):** `scripts/seed-demo-org.ts` — keep exports `seedDemoOrg`, `DEMO_ORG_NAME`, `DEMO_PASSWORD`, `DEMO_USERS`; replace `SHOPS`/`seedShop` internals.
- **Modify:** `scripts/reset-demo-org.ts` — add deletes for new tables.
- **Create (throwaway, git-ignored ok):** `scripts/qa-verify-demo.ts` — counts rows per shop to assert the seed worked.
- **Docs:** `docs/TESTING_LOG.md`, `docs/MULTI_VERTICAL_PLAN.md` — update on completion.

---

## Task 1: Scaffold types, PRNG, date + money helpers

**Files:**
- Modify: `scripts/seed-demo-org.ts` (top section, keep exports)

- [ ] **Step 1: Add imports, constants, helpers**

Replace the existing `SeedProduct` interface + `SHOPS` constant region with the scaffolding below (keep the file's existing imports of `PrismaClient, Prisma`, `bcrypt`, the `prisma` client, and the `DEMO_*` exports):

```ts
import type { OrganizationType } from '@prisma/client'
import { presetShopSettingsData } from '../src/lib/domain/business-presets'

const D = (n: number) => new Prisma.Decimal(Number(n.toFixed(2)))

// Fixed "today" so backfilled history is reproducible.
const TODAY = new Date('2026-06-19T12:00:00+05:00')
const dayMs = 86_400_000
/** A Date `n` days before TODAY (n=0 => today), at a pseudo-business hour. */
function daysAgo(n: number, hour = 13): Date {
  const d = new Date(TODAY.getTime() - n * dayMs)
  d.setHours(hour, 0, 0, 0)
  return d
}

/** Deterministic PRNG so demo numbers are stable across reseeds. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]
const randInt = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

type FeatureProfile = 'LEAN' | 'TRADE' | 'PHARMACY' | 'RESTAURANT' | 'SPECIALTY'

interface SeedLot { lotNo?: string; serial?: string; expiryDaysFromToday?: number; quantity: number; cost?: number }
interface SeedPackaging { name: string; factorToBase: number; price?: number; level: number; barcode?: string }
interface SeedProduct {
  name: string
  price: number
  cost: number
  unit?: string
  sku?: string
  barcode?: string
  category?: string
  stock?: number          // opening stock; omit => not stock-tracked
  reorderLevel?: number
  tradePrice?: number
  cartonSize?: number
  cartonPrice?: number
  cartonBarcode?: string
  archived?: boolean
  packaging?: SeedPackaging[]
  lots?: SeedLot[]
}
interface Vertical {
  type: OrganizationType
  shopName: string
  city: string
  profile: FeatureProfile
  products: SeedProduct[]
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (the `VERTICALS` array and helpers are referenced in later tasks; if "unused" lint complains, ignore — `tsc` won't error on unused in a script). If `tsc` errors that `VERTICALS` is missing, that's expected until Task 2 — proceed.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo-org.ts
git commit -m "chore(seed): scaffold demo-data generator types + helpers"
```

---

## Task 2: Author the 22 vertical catalogs

**Files:**
- Modify: `scripts/seed-demo-org.ts` (add `const VERTICALS: Vertical[] = [...]`)

This is the bulk creative data. Author **realistic, UPPERCASE** Pakistani-shop catalogs. Use the exact `Vertical`/`SeedProduct` shape from Task 1. Counts: 12–25 products per shop; give most a `category` and `reorderLevel`; some a `barcode`; mark 1 per shop `archived: true`. Apply profile-specific fields:
- **TRADE** shops: add `tradePrice` (≈ 6–12% below `price`) to most items; a few with `cartonSize` + `cartonPrice` + `cartonBarcode`.
- **PHARMACY**: add `packaging` (carton/box/tablet) to ≥3 items and `lots` (batch + `expiryDaysFromToday`) including **near-expiry** (e.g. 20) and **expired** (e.g. -10) lots.
- **SPECIALTY** electronics/mobile: add `lots` with `serial` (IMEI) and `quantity: 1` to high-value items.
- **RESTAURANT**: products are dishes (`unit: 'plate'`/`'item'`), no stock tracking needed on most (omit `stock`) — charges are exercised in Task 5.

- [ ] **Step 1: Add the `VERTICALS` array with all 22 entries**

Worked examples (follow this exact style for the remaining verticals):

```ts
const VERTICALS: Vertical[] = [
  {
    type: 'KIRYANA_STORE', shopName: 'Demo Kiryana Store', city: 'Lahore', profile: 'LEAN',
    products: [
      { name: 'COOKING OIL 1L', price: 650, cost: 560, category: 'Grocery', barcode: '8964000011111', stock: 80, reorderLevel: 20 },
      { name: 'SUGAR 1KG', price: 290, cost: 250, category: 'Grocery', stock: 120, reorderLevel: 30 },
      { name: 'WHEAT FLOUR 5KG', price: 1100, cost: 980, category: 'Grocery', stock: 60, reorderLevel: 15 },
      { name: 'TEA 250G', price: 480, cost: 400, category: 'Beverages', barcode: '8964000022222', stock: 40, reorderLevel: 10 },
      { name: 'BASMATI RICE 5KG', price: 1750, cost: 1550, category: 'Grocery', stock: 35, reorderLevel: 10 },
      { name: 'WASHING SOAP', price: 120, cost: 95, category: 'Household', stock: 200, reorderLevel: 40 },
      { name: 'SALT 800G', price: 60, cost: 45, category: 'Grocery', stock: 150, reorderLevel: 30 },
      { name: 'RED CHILLI POWDER 200G', price: 220, cost: 170, category: 'Spices', stock: 70, reorderLevel: 15 },
      { name: 'MILK PACK 1L', price: 320, cost: 290, category: 'Dairy', stock: 90, reorderLevel: 25 },
      { name: 'EGGS (DOZEN)', price: 360, cost: 320, category: 'Dairy', stock: 50, reorderLevel: 12 },
      { name: 'MATCHBOX (PACK)', price: 40, cost: 28, category: 'Household', stock: 300, reorderLevel: 50 },
      { name: 'BISCUITS FAMILY PACK', price: 150, cost: 115, category: 'Snacks', stock: 110, reorderLevel: 25 },
      { name: 'OLD STOCK CANDLE', price: 30, cost: 20, category: 'Household', stock: 0, reorderLevel: 0, archived: true },
    ],
  },
  {
    type: 'PHARMACY', shopName: 'Demo Pharmacy', city: 'Karachi', profile: 'PHARMACY',
    products: [
      {
        name: 'PARACETAMOL 500MG', price: 4.5, cost: 2.8, unit: 'tablet', category: 'Painkiller',
        barcode: '8964000033333', stock: 2000, reorderLevel: 500,
        packaging: [
          { name: 'Tablet', factorToBase: 1, level: 0 },
          { name: 'Box', factorToBase: 10, price: 45, level: 1 },
          { name: 'Carton', factorToBase: 200, price: 850, level: 2, barcode: '8964000033334' },
        ],
        lots: [
          { lotNo: 'BATCH-A', expiryDaysFromToday: 20, quantity: 300, cost: 2.7 },   // near-expiry
          { lotNo: 'BATCH-B', expiryDaysFromToday: 400, quantity: 1700, cost: 2.8 },
        ],
      },
      {
        name: 'AMOXICILLIN 250MG', price: 9, cost: 6, unit: 'capsule', category: 'Antibiotic', stock: 600, reorderLevel: 150,
        packaging: [
          { name: 'Capsule', factorToBase: 1, level: 0 },
          { name: 'Strip', factorToBase: 10, price: 95, level: 1 },
        ],
        lots: [
          { lotNo: 'EXP-OLD', expiryDaysFromToday: -10, quantity: 40, cost: 6 },     // expired
          { lotNo: 'AMX-22', expiryDaysFromToday: 300, quantity: 560, cost: 6 },
        ],
      },
      { name: 'IBUPROFEN 400MG', price: 6, cost: 3.8, unit: 'tablet', category: 'Painkiller', barcode: '8964000044444', stock: 1200, reorderLevel: 300,
        packaging: [ { name: 'Tablet', factorToBase: 1, level: 0 }, { name: 'Box', factorToBase: 10, price: 60, level: 1 } ] },
      { name: 'VITAMIN C 1000MG', price: 25, cost: 18, unit: 'tablet', category: 'Supplement', stock: 400, reorderLevel: 100 },
      { name: 'COUGH SYRUP 120ML', price: 220, cost: 160, unit: 'bottle', category: 'Syrup', barcode: '8964000055555', stock: 70, reorderLevel: 20,
        lots: [ { lotNo: 'CS-NEAR', expiryDaysFromToday: 25, quantity: 20, cost: 160 }, { lotNo: 'CS-OK', expiryDaysFromToday: 500, quantity: 50, cost: 160 } ] },
      { name: 'HAND SANITIZER 100ML', price: 180, cost: 120, unit: 'bottle', category: 'Hygiene', stock: 110, reorderLevel: 30 },
      { name: 'FACE MASK BOX 50', price: 450, cost: 300, unit: 'box', category: 'Hygiene', stock: 50, reorderLevel: 15 },
      { name: 'ORS SACHET', price: 35, cost: 22, unit: 'sachet', category: 'Supplement', stock: 500, reorderLevel: 100 },
      { name: 'BANDAGE ROLL', price: 90, cost: 60, unit: 'roll', category: 'First Aid', stock: 140, reorderLevel: 30 },
      { name: 'DISCONTINUED TONIC', price: 200, cost: 150, unit: 'bottle', category: 'Syrup', stock: 0, archived: true },
    ],
  },
  {
    type: 'RESTAURANT', shopName: 'Demo Restaurant', city: 'Lahore', profile: 'RESTAURANT',
    products: [
      { name: 'CHICKEN BIRYANI', price: 450, cost: 230, unit: 'plate', category: 'Rice' },
      { name: 'BEEF NIHARI', price: 520, cost: 280, unit: 'plate', category: 'Curry' },
      { name: 'CHICKEN KARAHI (FULL)', price: 1650, cost: 950, unit: 'item', category: 'Curry' },
      { name: 'SEEKH KEBAB (4 PCS)', price: 480, cost: 250, unit: 'item', category: 'BBQ' },
      { name: 'NAAN', price: 40, cost: 15, unit: 'item', category: 'Bread' },
      { name: 'GARLIC NAAN', price: 90, cost: 35, unit: 'item', category: 'Bread' },
      { name: 'SOFT DRINK 345ML', price: 90, cost: 60, unit: 'item', category: 'Beverages', stock: 240, reorderLevel: 48 },
      { name: 'MINERAL WATER 500ML', price: 60, cost: 35, unit: 'item', category: 'Beverages', stock: 300, reorderLevel: 60 },
      { name: 'KHEER', price: 180, cost: 80, unit: 'item', category: 'Dessert' },
      { name: 'GULAB JAMUN (2 PCS)', price: 160, cost: 70, unit: 'item', category: 'Dessert' },
      { name: 'TEA (CUP)', price: 80, cost: 25, unit: 'cup', category: 'Beverages' },
      { name: 'SEASONAL SOUP (OFF MENU)', price: 250, cost: 110, unit: 'bowl', category: 'Soup', archived: true },
    ],
  },
  // ... AUTHOR THE REMAINING 19 VERTICALS in this same shape:
  // GENERAL_STORE (LEAN, Islamabad), RETAIL_STORE (LEAN, Rawalpindi), SUPERMARKET (LEAN, Lahore, +barcodes),
  // CONVENIENCE_STORE (LEAN, Karachi), HARDWARE_STORE (TRADE, Faisalabad), SANITARY_STORE (TRADE, Gujranwala),
  // ELECTRONICS_STORE (TRADE+serial lots, Karachi), AUTO_PARTS (TRADE, Lahore), FURNITURE_STORE (TRADE, Chiniot),
  // WHOLESALE (TRADE, Faisalabad, carton-heavy), MOBILE_ACCESSORIES (SPECIALTY+serial lots, Karachi),
  // CLOTHING_STORE (SPECIALTY, Lahore), FOOTWEAR_STORE (SPECIALTY, Lahore), COSMETICS_STORE (SPECIALTY, Karachi),
  // JEWELRY_STORE (SPECIALTY, high prices, Lahore), OPTICAL_STORE (SPECIALTY, Islamabad),
  // STATIONERY_STORE (SPECIALTY, Multan), BAKERY (SPECIALTY, perishable, Lahore), OTHER (LEAN generic, Lahore).
]
```

Authoring rules for the 19: 12–20 products each, UPPERCASE, realistic PK prices in PKR, `category` on most, `reorderLevel` on stocked items, 1 `archived` item each, TRADE shops get `tradePrice` + a couple carton items, ELECTRONICS_STORE + MOBILE_ACCESSORIES get 2-3 items with `lots:[{serial:'IMEI...', quantity:1}]`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors in `VERTICALS`). Fix any shape mismatches.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo-org.ts
git commit -m "feat(seed): 22 per-vertical demo catalogs"
```

---

## Task 3: `seedShop()` — products, lots, packaging, suppliers, customers

**Files:**
- Modify: `scripts/seed-demo-org.ts` (replace old `seedShop`)

- [ ] **Step 1: Write the new `seedShop`**

Returns the created shop plus seeded products/customers/suppliers so Task 4 can drive activity.

```ts
interface SeededProduct { id: string; name: string; price: number; cost: number; tradePrice?: number; trackStock: boolean }
interface ShopContext {
  shop: { id: string }
  products: SeededProduct[]
  customers: { id: string; name: string }[]
  suppliers: { id: string }[]
  rng: () => number
}

async function seedShop(orgId: string, managerId: string, v: Vertical, shopIndex: number): Promise<ShopContext> {
  const rng = mulberry32(1000 + shopIndex * 97)
  const shop = await prisma.shop.create({
    data: {
      orgId, name: v.shopName, city: v.city,
      settings: { create: { timezone: 'Asia/Karachi', ...presetShopSettingsData(v.type) } },
      owners: { create: { userId: managerId, shopRole: 'STORE_MANAGER' } },
    },
  })

  const products: SeededProduct[] = []
  for (const p of v.products) {
    const tracks = p.stock != null
    const product = await prisma.product.create({
      data: {
        shopId: shop.id, name: p.name, unit: p.unit || 'pcs',
        sku: p.sku ?? null, barcode: p.barcode ?? null, category: p.category ?? null,
        price: D(p.price), costPrice: D(p.cost),
        tradePrice: p.tradePrice != null ? D(p.tradePrice) : null,
        cartonSize: p.cartonSize ?? null,
        cartonPrice: p.cartonPrice != null ? D(p.cartonPrice) : null,
        cartonBarcode: p.cartonBarcode ?? null,
        reorderLevel: p.reorderLevel ?? null,
        trackStock: tracks,
        archivedAt: p.archived ? daysAgo(60) : null,
      },
    })
    // Packaging levels
    if (p.packaging?.length) {
      for (const pk of p.packaging) {
        await prisma.packagingLevel.create({
          data: { productId: product.id, name: pk.name, factorToBase: D(pk.factorToBase),
            price: pk.price != null ? D(pk.price) : null, barcode: pk.barcode ?? null, level: pk.level },
        })
      }
    }
    // Opening stock ledger + stock lots
    if (tracks && p.stock! > 0) {
      await prisma.stockLedger.create({
        data: { shopId: shop.id, productId: product.id, changeQty: D(p.stock!), type: 'PURCHASE',
          refType: 'opening', createdAt: daysAgo(90) },
      })
    }
    if (p.lots?.length) {
      for (const lot of p.lots) {
        await prisma.stockLot.create({
          data: {
            shopId: shop.id, productId: product.id, lotNo: lot.lotNo ?? null, serial: lot.serial ?? null,
            expiry: lot.expiryDaysFromToday != null ? daysAgo(-lot.expiryDaysFromToday) : null,
            quantity: D(lot.quantity), costPrice: lot.cost != null ? D(lot.cost) : null, receivedAt: daysAgo(80),
          },
        })
      }
    }
    products.push({ id: product.id, name: product.name, price: p.price, cost: p.cost, tradePrice: p.tradePrice, trackStock: tracks })
  }

  // Customers: walk-in + named; ~30% carry an udhaar opening balance.
  const NAMES = ['ALI TRADERS','BILAL KHAN','FATIMA STORE','HASSAN & SONS','IMRAN ELECTRONICS','JAVED MART','KASHIF','MEHWISH','NADIA BEGUM','OMAR FAROOQ','QADEER','RIZWAN','SADIA','USMAN','WAQAR','ZAINAB']
  const nCust = randInt(rng, 8, 14)
  const customers: { id: string; name: string }[] = []
  const walkin = await prisma.customer.create({ data: { shopId: shop.id, name: 'WALK-IN CUSTOMER', phone: '03001234567' } })
  customers.push(walkin)
  for (let i = 0; i < nCust; i++) {
    const c = await prisma.customer.create({
      data: { shopId: shop.id, name: pick(rng, NAMES) + ' ' + (i + 1), phone: '0300' + randInt(rng, 1000000, 9999999) },
    })
    customers.push(c)
    if (rng() < 0.3) {
      const bal = randInt(rng, 1, 8) * 1000
      await prisma.customerLedger.create({
        data: { shopId: shop.id, customerId: c.id, type: 'ADJUSTMENT', direction: 'DEBIT', amount: D(bal),
          refType: 'opening_balance', createdAt: daysAgo(88) },
      })
    }
  }

  // Suppliers (2-3) with payables ledger.
  const suppliers: { id: string }[] = []
  const nSup = randInt(rng, 2, 3)
  for (let i = 0; i < nSup; i++) {
    const s = await prisma.supplier.create({ data: { shopId: shop.id, name: `${v.city} WHOLESALE CO ${i + 1}`, phone: '042' + randInt(rng, 1000000, 9999999) } })
    suppliers.push(s)
    await prisma.supplierLedger.createMany({
      data: [
        { shopId: shop.id, supplierId: s.id, type: 'OPENING_BALANCE', direction: 'CREDIT', amount: D(randInt(rng, 10, 40) * 1000), refType: 'opening', createdByUserId: managerId, createdAt: daysAgo(89) },
        { shopId: shop.id, supplierId: s.id, type: 'PAYMENT_MADE', direction: 'DEBIT', amount: D(randInt(rng, 5, 15) * 1000), method: rng() < 0.5 ? 'CASH' : 'CARD', refType: 'payment', createdByUserId: managerId, createdAt: daysAgo(randInt(rng, 10, 70)) },
        { shopId: shop.id, supplierId: s.id, type: 'ADJUSTMENT', direction: 'CREDIT', amount: D(randInt(rng, 1, 3) * 500), refType: 'adjustment', note: 'Price correction', createdByUserId: managerId, createdAt: daysAgo(randInt(rng, 5, 40)) },
      ],
    })
  }

  return { shop, products, customers, suppliers, rng }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo-org.ts
git commit -m "feat(seed): seedShop builds catalog, lots, packaging, customers, suppliers"
```

---

## Task 4: `simulate90Days()` — purchases, sales, payments, returns, quotations, expenses, stock moves

**Files:**
- Modify: `scripts/seed-demo-org.ts`

- [ ] **Step 1: Write the activity engine**

```ts
const EXPENSE_CATS = ['Utilities','Rent','Salaries','Transport','Supplies','Marketing','Misc']

async function simulate90Days(orgId: string, managerId: string, v: Vertical, ctx: ShopContext) {
  const { shop, products, customers, suppliers, rng } = ctx
  const stocked = products.filter((p) => p.trackStock)
  const named = customers.filter((c) => c.name !== 'WALK-IN CUSTOMER')
  let invoiceNo = 0
  const nextNo = () => String(++invoiceNo).padStart(6, '0')
  const isTrade = v.profile === 'TRADE'
  const isRestaurant = v.profile === 'RESTAURANT'

  // --- Purchases over the period (restock) ---
  const nPurchases = randInt(rng, 4, 8)
  for (let i = 0; i < nPurchases && suppliers.length; i++) {
    const when = daysAgo(randInt(rng, 1, 85))
    const lineProducts = stocked.length ? Array.from({ length: randInt(rng, 2, 5) }, () => pick(rng, stocked)) : []
    if (!lineProducts.length) break
    const purchase = await prisma.purchase.create({
      data: { shopId: shop.id, supplierId: pick(rng, suppliers).id, date: when, createdAt: when,
        reference: 'PO-' + (1000 + i), createdByUserId: managerId,
        lines: { create: lineProducts.map((p) => ({ productId: p.id, quantity: D(randInt(rng, 5, 30)), unitCost: D(p.cost) })) } },
      include: { lines: true },
    })
    for (const ln of purchase.lines) {
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: ln.productId, changeQty: D(Number(ln.quantity)), type: 'PURCHASE', refType: 'purchase_line', refId: ln.id, createdAt: when } })
    }
  }

  // --- Sales across 90 days ---
  const nSales = randInt(rng, 45, 70)
  const madeInvoices: { id: string; total: number; customerId: string; items: { productId: string; qty: number; price: number }[] }[] = []
  for (let i = 0; i < nSales; i++) {
    const when = daysAgo(randInt(rng, 0, 89), randInt(rng, 10, 21))
    const itemCount = randInt(rng, 1, 4)
    const chosen = Array.from({ length: itemCount }, () => pick(rng, products))
    const items = chosen.map((p) => {
      const qty = randInt(rng, 1, 3)
      const price = isTrade && p.tradePrice && rng() < 0.5 ? p.tradePrice : p.price
      return { productId: p.id, qty, price }
    })
    const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const discount = rng() < 0.25 ? Math.round(subtotal * (rng() < 0.5 ? 0.05 : 0.1)) : 0
    const serviceCharge = isRestaurant ? Math.round((subtotal - discount) * 0.05) : 0
    const deliveryCharge = isRestaurant && rng() < 0.3 ? 100 : 0
    const r = rng()
    const isUdhaar = r < 0.2 && named.length > 0
    const isPartial = !isUdhaar && r < 0.28 && named.length > 0
    const isCard = !isUdhaar && !isPartial && rng() < 0.3
    const cardFee = isCard ? Math.round((subtotal - discount + serviceCharge + deliveryCharge) * 0.01) : 0
    const total = subtotal - discount + serviceCharge + deliveryCharge + cardFee
    const customer = isUdhaar || isPartial ? pick(rng, named) : (rng() < 0.5 ? customers[0] : pick(rng, customers))
    const invoice = await prisma.invoice.create({
      data: {
        shopId: shop.id, customerId: customer.id, number: nextNo(), createdAt: when,
        status: 'COMPLETED',
        paymentStatus: isUdhaar ? 'UDHAAR' : isPartial ? 'PARTIAL' : 'PAID',
        paymentMethod: isUdhaar ? null : isCard ? 'CARD' : (rng() < 0.1 ? 'OTHER' : 'CASH'),
        subtotal: D(subtotal), discount: D(discount), serviceCharge: D(serviceCharge), deliveryCharge: D(deliveryCharge), total: D(total),
        createdByUserId: managerId,
        lines: { create: items.map((it) => ({ productId: it.productId, quantity: D(it.qty), unitPrice: D(it.price), lineTotal: D(it.price * it.qty), createdAt: when })) },
      },
      include: { lines: true },
    })
    for (const ln of invoice.lines) {
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: ln.productId, changeQty: D(-Number(ln.quantity)), type: 'SALE', refType: 'invoice_line', refId: ln.id, createdAt: when } })
    }
    if (isUdhaar) {
      await prisma.customerLedger.create({ data: { shopId: shop.id, customerId: customer.id, type: 'SALE_UDHAAR', direction: 'DEBIT', amount: D(total), refType: 'invoice', refId: invoice.id, createdAt: when } })
    } else if (isPartial) {
      const paidPart = Math.round(total * 0.5)
      await prisma.payment.create({ data: { shopId: shop.id, invoiceId: invoice.id, amount: D(paidPart), method: 'CASH', createdAt: when } })
      await prisma.customerLedger.create({ data: { shopId: shop.id, customerId: customer.id, type: 'SALE_UDHAAR', direction: 'DEBIT', amount: D(total - paidPart), refType: 'invoice', refId: invoice.id, createdAt: when } })
    } else {
      await prisma.payment.create({ data: { shopId: shop.id, invoiceId: invoice.id, amount: D(total), method: isCard ? 'CARD' : 'CASH', createdAt: when } })
    }
    madeInvoices.push({ id: invoice.id, total, customerId: customer.id, items: items.map((it) => ({ productId: it.productId, qty: it.qty, price: it.price })) })
  }

  // --- A couple of VOID invoices (stock reversed) ---
  for (let i = 0; i < 2 && stocked.length; i++) {
    const when = daysAgo(randInt(rng, 5, 60))
    const p = pick(rng, stocked); const qty = 1
    const inv = await prisma.invoice.create({
      data: { shopId: shop.id, customerId: customers[0].id, number: nextNo(), createdAt: when, status: 'VOID',
        paymentStatus: 'PAID', paymentMethod: 'CASH', subtotal: D(p.price), discount: D(0), total: D(p.price), createdByUserId: managerId,
        lines: { create: [{ productId: p.id, quantity: D(qty), unitPrice: D(p.price), lineTotal: D(p.price), createdAt: when }] } },
    })
    // void => no net stock change: no SALE ledger written (mirrors a sale that was voided before fulfillment)
    void inv
  }

  // --- Udhaar receipts (cash-in) for some udhaar customers ---
  for (const c of named) {
    if (rng() < 0.4) {
      const amt = randInt(rng, 1, 5) * 500
      const when = daysAgo(randInt(rng, 1, 50))
      await prisma.payment.create({ data: { shopId: shop.id, customerId: c.id, amount: D(amt), method: 'CASH', note: 'Udhaar received', createdAt: when } })
      await prisma.customerLedger.create({ data: { shopId: shop.id, customerId: c.id, type: 'PAYMENT_RECEIVED', direction: 'CREDIT', amount: D(amt), refType: 'payment', createdAt: when } })
    }
  }

  // --- Sale returns: 1 refund (cash), 1 refund (account credit), 1 exchange ---
  const refundable = madeInvoices.filter((m) => m.items.length).slice(0, 3)
  for (let idx = 0; idx < refundable.length; idx++) {
    const m = refundable[idx]
    const it = m.items[0]
    const when = daysAgo(randInt(rng, 1, 30))
    const returnTotal = it.price * 1
    const kind = idx === 2 ? 'EXCHANGE' : 'REFUND'
    const settlement = idx === 1 ? 'ACCOUNT_CREDIT' : 'CASH'
    const replacementTotal = kind === 'EXCHANGE' ? it.price : 0
    const netRefund = returnTotal - replacementTotal
    const restocked = idx !== 0 // first return is damaged (not restocked)
    const sr = await prisma.saleReturn.create({
      data: {
        shopId: shop.id, originalInvoiceId: m.id, customerId: m.customerId, kind, createdAt: when,
        returnTotal: D(returnTotal), replacementTotal: D(replacementTotal), netRefund: D(netRefund),
        settlementMethod: settlement, createdByUserId: managerId,
        lines: { create: [
          { productId: it.productId, quantity: D(1), unitPrice: D(it.price), lineTotal: D(it.price), isReplacement: false, restocked },
          ...(kind === 'EXCHANGE' ? [{ productId: it.productId, quantity: D(1), unitPrice: D(it.price), lineTotal: D(it.price), isReplacement: true, restocked: false }] : []),
        ] },
      },
    })
    if (restocked) {
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: it.productId, changeQty: D(1), type: 'RETURN', refType: 'sale_return', refId: sr.id, createdAt: when } })
    } else {
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: it.productId, changeQty: D(0), type: 'DAMAGE', refType: 'sale_return', refId: sr.id, createdAt: when } })
    }
    if (settlement === 'CASH' && netRefund > 0) {
      await prisma.payment.create({ data: { shopId: shop.id, customerId: m.customerId, amount: D(-netRefund), method: 'CASH', note: 'Refund', createdAt: when } })
    } else if (settlement === 'ACCOUNT_CREDIT' && netRefund > 0) {
      await prisma.customerLedger.create({ data: { shopId: shop.id, customerId: m.customerId, type: 'ADJUSTMENT', direction: 'CREDIT', amount: D(netRefund), refType: 'sale_return', refId: sr.id, createdAt: when } })
    }
  }

  // --- Quotations (quote-enabled shops only): OPEN, CANCELLED, CONVERTED ---
  if (v.profile === 'TRADE') {
    const mkLines = () => Array.from({ length: randInt(rng, 1, 3) }, () => { const p = pick(rng, products); const q = randInt(rng, 1, 5); return { productId: p.id, quantity: D(q), unitPrice: D(p.tradePrice ?? p.price), lineTotal: D((p.tradePrice ?? p.price) * q) } })
    const sum = (ls: { lineTotal: Prisma.Decimal }[]) => ls.reduce((s, l) => s + Number(l.lineTotal), 0)
    let qno = 0; const nextQ = () => 'Q' + String(++qno).padStart(6, '0')
    for (const status of ['OPEN', 'CANCELLED', 'CONVERTED'] as const) {
      const when = daysAgo(randInt(rng, 5, 40))
      const lines = mkLines(); const subtotal = sum(lines)
      const q = await prisma.quotation.create({
        data: { shopId: shop.id, customerName: 'CONTRACTOR ' + status, number: nextQ(), status, createdAt: when, updatedAt: when,
          subtotal: D(subtotal), discount: D(0), total: D(subtotal), validUntil: daysAgo(-15), note: 'Site quotation',
          createdByUserId: managerId, lines: { create: lines } },
      })
      if (status === 'CONVERTED') {
        const inv = await prisma.invoice.create({
          data: { shopId: shop.id, customerId: customers[0].id, number: nextNo(), createdAt: when, status: 'COMPLETED', paymentStatus: 'PAID', paymentMethod: 'CASH', subtotal: D(subtotal), discount: D(0), total: D(subtotal), createdByUserId: managerId,
            lines: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, createdAt: when })) } },
          include: { lines: true },
        })
        for (const ln of inv.lines) await prisma.stockLedger.create({ data: { shopId: shop.id, productId: ln.productId, changeQty: D(-Number(ln.quantity)), type: 'SALE', refType: 'invoice_line', refId: ln.id, createdAt: when } })
        await prisma.payment.create({ data: { shopId: shop.id, invoiceId: inv.id, amount: D(subtotal), method: 'CASH', createdAt: when } })
        await prisma.quotation.update({ where: { id: q.id }, data: { convertedInvoiceId: inv.id, convertedAt: when } })
      }
    }
  }

  // --- Misc stock movements: ADJUSTMENT, EXPIRY, SELF_USE ---
  if (stocked.length) {
    const a = pick(rng, stocked)
    await prisma.stockLedger.create({ data: { shopId: shop.id, productId: a.id, changeQty: D(-randInt(rng, 1, 3)), type: 'ADJUSTMENT', refType: 'manual', note: undefined as any, createdAt: daysAgo(randInt(rng, 5, 40)) } })
    const b = pick(rng, stocked)
    await prisma.stockLedger.create({ data: { shopId: shop.id, productId: b.id, changeQty: D(-1), type: 'SELF_USE', refType: 'manual', createdAt: daysAgo(randInt(rng, 5, 40)) } })
    if (v.profile === 'PHARMACY' || v.profile === 'SPECIALTY') {
      const c = pick(rng, stocked)
      await prisma.stockLedger.create({ data: { shopId: shop.id, productId: c.id, changeQty: D(-randInt(rng, 1, 5)), type: 'EXPIRY', refType: 'manual', createdAt: daysAgo(randInt(rng, 5, 40)) } })
    }
  }

  // --- Expenses across categories over the period ---
  const nExp = randInt(rng, 10, 18)
  const expenses = Array.from({ length: nExp }, () => {
    const when = daysAgo(randInt(rng, 0, 89))
    return { shopId: shop.id, userId: managerId, amount: D(randInt(rng, 2, 30) * 500), category: pick(rng, EXPENSE_CATS), description: 'Demo expense', date: when, createdAt: when }
  })
  await prisma.expense.createMany({ data: expenses })
}
```

> Note: `StockLedger`/`SupplierLedger` have no `note` field in some cases — remove `note`/cast issues if `tsc` flags them. `StockLedger` has no `note` column: drop the `note: undefined as any` and just omit it. Verify against `prisma/schema.prisma` lines 387-402 during implementation and adjust.

- [ ] **Step 2: Typecheck and fix field mismatches**

Run: `npx tsc --noEmit`
Expected: PASS. If errors reference non-existent columns (e.g. `StockLedger.note`), remove those fields — the schema is the source of truth.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo-org.ts
git commit -m "feat(seed): 90-day activity simulator (sales/returns/quotations/expenses/stock)"
```

---

## Task 5: Wire `seedDemoOrg()` to iterate all verticals

**Files:**
- Modify: `scripts/seed-demo-org.ts` (the `seedDemoOrg` function + the shop loop)

- [ ] **Step 1: Replace the shop loop**

In `seedDemoOrg`, keep org + 3 users creation. Replace the `for (const def of SHOPS)` block with:

```ts
  const shopIds: string[] = []
  for (let i = 0; i < VERTICALS.length; i++) {
    const ctx = await seedShop(org.id, manager.id, VERTICALS[i], i)
    await simulate90Days(org.id, manager.id, VERTICALS[i], ctx)
    shopIds.push(ctx.shop.id)
    console.log(`  seeded ${VERTICALS[i].shopName} (${i + 1}/${VERTICALS.length})`)
  }
  // Cashier limited to the first shop.
  await prisma.userShop.create({ data: { userId: cashier.id, shopId: shopIds[0], shopRole: 'CASHIER' } })
```

Remove the now-unused old `SHOPS` constant and old `makeSale` helper if any remain.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, no unused-variable errors that block compilation.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo-org.ts
git commit -m "feat(seed): seedDemoOrg iterates all 22 verticals with 90-day activity"
```

---

## Task 6: Fix `reset-demo-org.ts` to clean newer tables

**Files:**
- Modify: `scripts/reset-demo-org.ts:43-56`

- [ ] **Step 1: Add deletes for new tables (FK-safe order)**

Insert these BEFORE the `product`/`customer` deletes (children first):

```ts
  await safeDeleteMany(() => prisma.saleReturnLine.deleteMany({ where: { saleReturn: { shopId: { in: shopIds } } } }))
  await safeDeleteMany(() => prisma.saleReturn.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.quotationLine.deleteMany({ where: { quotation: { shopId: { in: shopIds } } } }))
  await safeDeleteMany(() => prisma.quotation.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.stockLot.deleteMany({ where: inShop }))
  await safeDeleteMany(() => prisma.packagingLevel.deleteMany({ where: { product: { shopId: { in: shopIds } } } }))
```

Place them right after the existing `payment`/ledger deletes and before `invoiceLine`/`invoice` (SaleReturn references Invoice, so delete SaleReturn before Invoice; PackagingLevel references Product so before Product).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/reset-demo-org.ts
git commit -m "fix(seed): reset-demo-org cleans returns/quotations/lots/packaging"
```

---

## Task 7: Verification query script + run the reset

**Files:**
- Create: `scripts/qa-verify-demo.ts`

- [ ] **Step 1: Write the verifier**

```ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const org = await prisma.organization.findFirst({ where: { isDemo: true }, include: { } })
  if (!org) throw new Error('no demo org')
  const shops = await prisma.shop.findMany({ where: { orgId: org.id } })
  console.log(`Org ${org.name} (${org.id}) — ${shops.length} shops`)
  for (const s of shops) {
    const [products, invoices, voids, returns, quotes, lots, packaging, expenses, customers, suppliers] = await Promise.all([
      prisma.product.count({ where: { shopId: s.id } }),
      prisma.invoice.count({ where: { shopId: s.id } }),
      prisma.invoice.count({ where: { shopId: s.id, status: 'VOID' } }),
      prisma.saleReturn.count({ where: { shopId: s.id } }),
      prisma.quotation.count({ where: { shopId: s.id } }),
      prisma.stockLot.count({ where: { shopId: s.id } }),
      prisma.packagingLevel.count({ where: { product: { shopId: s.id } } }),
      prisma.expense.count({ where: { shopId: s.id } }),
      prisma.customer.count({ where: { shopId: s.id } }),
      prisma.supplier.count({ where: { shopId: s.id } }),
    ])
    console.log(`${s.name.padEnd(28)} P:${products} INV:${invoices}(void ${voids}) RET:${returns} Q:${quotes} LOT:${lots} PKG:${packaging} EXP:${expenses} C:${customers} S:${suppliers}`)
  }
}
main().then(() => prisma.$disconnect())
```

- [ ] **Step 2: Run the reset against the demo org (scoped, hard-guarded)**

Run: `npx tsx scripts/reset-demo-org.ts`
Expected: "Resetting demo org ... Teardown complete. Re-seeding baseline..." then per-shop "seeded ..." lines for all 22, then "Demo org seeded." No FK errors.

- [ ] **Step 3: Verify counts**

Run: `npx tsx scripts/qa-verify-demo.ts`
Expected: 22 shops; every shop P≥12, INV≥40, EXP≥10, C≥8, S≥2; pharmacy shows LOT>0 and PKG>0; TRADE shops show Q=3; every shop RET=3, void=2.

- [ ] **Step 4: Commit**

```bash
git add scripts/qa-verify-demo.ts
git commit -m "chore(seed): demo data verification query script"
```

---

## Task 8: Playwright verification — rendering + allowed live flows

**Files:** none (manual via Playwright MCP). Restart dev first.

- [ ] **Step 1: Restart dev server**

Run: stop any running `npm run dev`, then `npx prisma generate` and `npm run dev`. Wait for `http://localhost:3000`.

- [ ] **Step 2: Login + per-profile rendering checks**

Login `demo.manager@cartpos.app` / `Demo@12345`. For one shop per profile (Kiryana, Pharmacy, Restaurant, Hardware, Electronics, Bakery), use the shop switcher and confirm:
- POS page renders products + search returns hits.
- Products list shows categories; archived item is hidden from list/POS.
- Reports/dashboard: sales + profit + 7-day trend + top products populated (90-day data).
- Cash Book: in/out/net reconcile (non-zero rows).
- Customers: list + a statement page shows running udhaar balance.
- Suppliers: payables statement non-zero.
- Quotations nav present + lists OPEN/CONVERTED/CANCELLED (hardware/electronics only); absent for kiryana.
- Expiry alerts page lists near-expiry + expired lots (pharmacy).
- A restaurant receipt shows Service charge + (some) Delivery line.

Record PASS/FAIL per check.

- [ ] **Step 3: Exercise allowed live flows**

In Kiryana shop: ring up a CASH sale with a manual discount and confirm change/receipt; add a new product; add a new customer; record an udhaar payment for a customer with a balance. Confirm each succeeds (these are NOT demo-blocked).

- [ ] **Step 4: Confirm guard blocks destructive ops**

Attempt a sale void / a return / a quotation create in the UI; confirm 403 `DEMO_READONLY` / blocked UI + amber demo banner present.

---

## Task 9: Playwright — blocked-ops live test via toggle-demo-lock, then restore

**Files:** none (uses existing `scripts/toggle-demo-lock.ts`).

- [ ] **Step 1: Unlock**

Run: `npx tsx scripts/toggle-demo-lock.ts off`
Then re-login in the browser (session reads `isDemoOrg` per request).

- [ ] **Step 2: Test the previously-blocked flows live**

In a TRADE shop + Pharmacy: create a quotation → convert to a cash sale (confirm it appears in Sales + stock dropped); create a sale return (refund) from the Sales list; void a sale; edit a product price. Confirm each succeeds and reports/cash book update.

- [ ] **Step 3: Re-lock and restore baseline**

Run: `npx tsx scripts/toggle-demo-lock.ts on`
Run: `npx tsx scripts/reset-demo-org.ts`  (restores the pristine rich 22-shop baseline; wipes the test artifacts created in Step 2)
Run: `npx tsx scripts/qa-verify-demo.ts`  (confirm counts back to baseline)

- [ ] **Step 4: Confirm re-lock**

Re-login; confirm amber demo banner is back and a destructive action is blocked again.

---

## Task 10: Update docs (mandatory — CLAUDE.md rule)

**Files:**
- Modify: `docs/TESTING_LOG.md`
- Modify: `docs/MULTI_VERTICAL_PLAN.md`

- [ ] **Step 1: Update TESTING_LOG.md**

In the "PERMANENT DEMO / TEST ORG" section, update the shop count + data description to: 22 shops (one per business type), rich 90-day history exercising every entity/field. Add a dated bullet with the Playwright verification results (Task 8/9 PASS/FAIL) and note the seed is now data-driven via `VERTICALS[]`.

- [ ] **Step 2: Update MULTI_VERTICAL_PLAN.md**

Mark Phase 4 "demo data" as done (date 2026-06-19) with a one-line pointer to `seed-demo-org.ts` 22-vertical generator.

- [ ] **Step 3: Commit**

```bash
git add docs/TESTING_LOG.md docs/MULTI_VERTICAL_PLAN.md
git commit -m "docs: rich 22-shop demo data + verification results"
```

---

## Self-review notes (coverage vs spec)
- 22 shops one-per-type ✔ (Task 2 + 5). Per-shop preset flags ✔ (Task 3 `presetShopSettingsData`).
- Every entity: Product/packaging/lots ✔ (T3); purchases/supplier ledger ✔ (T3/T4); invoices PAID/UDHAAR/PARTIAL/VOID + card fee + discount + service/delivery ✔ (T4); payments incl. udhaar receipts + refunds ✔ (T4); returns refund(cash/credit)+exchange, restocked/damaged ✔ (T4); quotations OPEN/CANCELLED/CONVERTED ✔ (T4); all 7 stock-move types ✔ (T3 PURCHASE/SALE + T4 ADJUSTMENT/DAMAGE/EXPIRY/RETURN/SELF_USE); expenses many categories ✔ (T4).
- 90-day backdating via explicit `createdAt`/`date`/`receivedAt` ✔.
- Reset cleanup for new tables ✔ (T6). Verification ✔ (T7). Playwright allowed + blocked flows ✔ (T8/T9). Docs ✔ (T10).
- **Implementer caution:** the engine references columns — verify each against `prisma/schema.prisma` while implementing; drop any field the schema lacks (e.g. `StockLedger` has no `note`). This is the one place to cross-check, not assume.
