/**
 * Seed the persistent DEMO / TEST org — a stable fixture for QA and live demos.
 *
 *   npx tsx scripts/seed-demo-org.ts
 *
 * Creates ONE org (isDemo=true) with 4 shops of different business types, 3 users
 * (org admin / store manager / cashier), and per-shop products, customers, suppliers,
 * sample sales (cash + udhaar), payments, expenses — so Reports & Cash Book show real data.
 *
 * Idempotent: if the demo org already exists it does nothing. To rebuild the baseline,
 * run scripts/reset-demo-org.ts (which wipes the demo org's data and re-seeds).
 *
 * Demo users (password below) can use the app normally but CANNOT perform destructive
 * actions — Organization.isDemo blocks them at the API layer (see src/lib/demo.ts).
 */
import { PrismaClient, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export const DEMO_ORG_NAME = 'CartPOS Demo'
export const DEMO_PASSWORD = 'Demo@12345' // meets policy: 10+ chars, upper/lower/number/symbol
export const DEMO_USERS = {
  admin: 'demo.admin@cartpos.app',
  manager: 'demo.manager@cartpos.app',
  cashier: 'demo.cashier@cartpos.app',
}

const D = (n: number) => new Prisma.Decimal(n)

interface SeedProduct {
  name: string
  price: number
  cost: number
  unit?: string
  barcode?: string
  stock?: number // initial stock-in (omit → not stock-tracked)
}

const SHOPS: { name: string; city: string; products: SeedProduct[] }[] = [
  {
    name: 'Demo Kiryana Store',
    city: 'Lahore',
    products: [
      { name: 'COOKING OIL 1L', price: 650, cost: 560, barcode: '8964000011111', stock: 80 },
      { name: 'SUGAR 1KG', price: 290, cost: 250, stock: 120 },
      { name: 'WHEAT FLOUR 5KG', price: 1100, cost: 980, stock: 60 },
      { name: 'TEA 250G', price: 480, cost: 400, barcode: '8964000022222', stock: 40 },
      { name: 'BASMATI RICE 5KG', price: 1750, cost: 1550, stock: 35 },
      { name: 'WASHING SOAP', price: 120, cost: 95, stock: 200 },
    ],
  },
  {
    name: 'Demo Pharmacy',
    city: 'Karachi',
    products: [
      { name: 'PARACETAMOL 500MG', price: 35, cost: 22, barcode: '8964000033333', stock: 300 },
      { name: 'IBUPROFEN 400MG', price: 80, cost: 55, barcode: '8964000044444', stock: 180 },
      { name: 'VITAMIN C 1000MG', price: 250, cost: 180, stock: 90 },
      { name: 'COUGH SYRUP 120ML', price: 220, cost: 160, barcode: '8964000055555', stock: 70 },
      { name: 'HAND SANITIZER 100ML', price: 180, cost: 120, stock: 110 },
      { name: 'FACE MASK (BOX 50)', price: 450, cost: 300, stock: 50 },
    ],
  },
  {
    name: 'Demo Hardware & Sanitary',
    city: 'Faisalabad',
    products: [
      { name: 'PVC PIPE 1IN (PER FT)', price: 75, cost: 55, unit: 'ft', stock: 500 },
      { name: 'CEMENT BAG 50KG', price: 1350, cost: 1220, stock: 40 },
      { name: 'WATER TAP BRASS', price: 850, cost: 620, stock: 60 },
      { name: 'PAINT 1 GALLON', price: 2200, cost: 1850, stock: 25 },
      { name: 'TILE ADHESIVE 20KG', price: 980, cost: 820, stock: 45 },
    ],
  },
  {
    name: 'Demo Garments',
    city: 'Lahore',
    products: [
      { name: "MEN'S T-SHIRT", price: 1200, cost: 750, stock: 80 },
      { name: 'DENIM JEANS', price: 2800, cost: 1900, stock: 50 },
      { name: 'KURTA (UNSTITCHED)', price: 3500, cost: 2400, stock: 40 },
      { name: 'WINTER HOODIE', price: 2400, cost: 1600, stock: 35 },
      { name: 'COTTON SOCKS (PAIR)', price: 250, cost: 140, stock: 200 },
    ],
  },
]

async function seedShop(orgId: string, managerId: string, def: (typeof SHOPS)[number]) {
  const shop = await prisma.shop.create({
    data: {
      orgId,
      name: def.name,
      city: def.city,
      settings: { create: { timezone: 'Asia/Karachi' } },
      owners: { create: { userId: managerId, shopRole: 'STORE_MANAGER' } },
    },
  })

  // Products + opening stock
  type SeededProduct = Awaited<ReturnType<typeof prisma.product.create>> & { _cost: number; _price: number }
  const products: SeededProduct[] = []
  for (const p of def.products) {
    const tracks = p.stock != null
    const product = await prisma.product.create({
      data: {
        shopId: shop.id,
        name: p.name,
        unit: p.unit || 'pcs',
        price: D(p.price),
        costPrice: D(p.cost),
        barcode: p.barcode || null,
        trackStock: tracks,
        sku: null,
      },
    })
    if (tracks) {
      await prisma.stockLedger.create({
        data: {
          shopId: shop.id,
          productId: product.id,
          changeQty: D(p.stock!),
          type: 'PURCHASE',
          refType: 'opening',
        },
      })
    }
    products.push({ ...product, _cost: p.cost, _price: p.price })
  }

  // Customers (one with udhaar opening balance)
  const cust1 = await prisma.customer.create({
    data: { shopId: shop.id, name: 'Walk-in Regular', phone: '03001234567' },
  })
  const cust2 = await prisma.customer.create({
    data: { shopId: shop.id, name: 'Udhaar Customer', phone: '03007654321' },
  })
  await prisma.customerLedger.create({
    data: {
      shopId: shop.id,
      customerId: cust2.id,
      type: 'ADJUSTMENT',
      direction: 'DEBIT',
      amount: D(3000),
      refType: 'opening_balance',
    },
  })

  // Supplier with payables (opening credit + a cash payment)
  const supplier = await prisma.supplier.create({
    data: { shopId: shop.id, name: `${def.city} Wholesale Co`, phone: '04200000000' },
  })
  await prisma.supplierLedger.createMany({
    data: [
      {
        shopId: shop.id,
        supplierId: supplier.id,
        type: 'OPENING_BALANCE',
        direction: 'CREDIT',
        amount: D(20000),
        refType: 'opening',
        createdByUserId: managerId,
      },
      {
        shopId: shop.id,
        supplierId: supplier.id,
        type: 'PAYMENT_MADE',
        direction: 'DEBIT',
        amount: D(8000),
        method: 'CASH',
        refType: 'payment',
        createdByUserId: managerId,
      },
    ],
  })

  // Sample sales: one CASH (paid) + one UDHAAR, two line items each
  let invoiceNo = 0
  const nextNo = () => String(++invoiceNo).padStart(6, '0')

  async function makeSale(items: { p: (typeof products)[number]; qty: number }[], paid: boolean) {
    const subtotal = items.reduce((s, it) => s + it.p._price * it.qty, 0)
    const total = subtotal
    const invoice = await prisma.invoice.create({
      data: {
        shopId: shop.id,
        customerId: paid ? cust1.id : cust2.id,
        number: nextNo(),
        paymentStatus: paid ? 'PAID' : 'UDHAAR',
        paymentMethod: paid ? 'CASH' : null,
        subtotal: D(subtotal),
        discount: D(0),
        total: D(total),
        createdByUserId: managerId,
        lines: {
          create: items.map((it) => ({
            productId: it.p.id,
            quantity: D(it.qty),
            unitPrice: D(it.p._price),
            lineTotal: D(it.p._price * it.qty),
          })),
        },
      },
      include: { lines: true },
    })
    // Stock out
    for (const ln of invoice.lines) {
      await prisma.stockLedger.create({
        data: {
          shopId: shop.id,
          productId: ln.productId,
          changeQty: D(-Number(ln.quantity)),
          type: 'SALE',
          refType: 'invoice_line',
          refId: ln.id,
        },
      })
    }
    if (paid) {
      await prisma.payment.create({
        data: { shopId: shop.id, invoiceId: invoice.id, amount: D(total), method: 'CASH' },
      })
    } else {
      await prisma.customerLedger.create({
        data: {
          shopId: shop.id,
          customerId: cust2.id,
          type: 'SALE_UDHAAR',
          direction: 'DEBIT',
          amount: D(total),
          refType: 'invoice',
          refId: invoice.id,
        },
      })
    }
  }

  await makeSale([{ p: products[0], qty: 2 }, { p: products[1], qty: 1 }], true)
  await makeSale([{ p: products[2], qty: 1 }, { p: products[3], qty: 3 }], false)

  // An udhaar cash payment received (shows as cash-in on the cash book)
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: cust2.id, amount: D(1500), method: 'CASH', note: 'Udhaar received' },
  })
  await prisma.customerLedger.create({
    data: {
      shopId: shop.id,
      customerId: cust2.id,
      type: 'PAYMENT_RECEIVED',
      direction: 'CREDIT',
      amount: D(1500),
      refType: 'payment',
    },
  })

  // Expenses (cash out)
  await prisma.expense.createMany({
    data: [
      { shopId: shop.id, userId: managerId, amount: D(1200), category: 'Utilities', description: 'Electricity bill' },
      { shopId: shop.id, userId: managerId, amount: D(800), category: 'Transport', description: 'Delivery fuel' },
    ],
  })

  return shop
}

export async function seedDemoOrg() {
  const existing = await prisma.organization.findFirst({ where: { isDemo: true } })
  if (existing) {
    console.log(`Demo org already exists (${existing.name}, id=${existing.id}). Skipping. Use reset-demo-org.ts to rebuild.`)
    return existing
  }

  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12)

  const org = await prisma.organization.create({
    data: {
      name: DEMO_ORG_NAME,
      type: 'GENERAL_STORE',
      status: 'ACTIVE',
      isDemo: true,
      city: 'Lahore',
      approvedAt: new Date(),
    },
  })

  const admin = await prisma.user.create({
    data: { name: 'Demo Admin', email: DEMO_USERS.admin, password: hashed, role: 'NORMAL', emailVerified: true, organizations: { create: { orgId: org.id, orgRole: 'ORG_ADMIN' } } },
  })
  const manager = await prisma.user.create({
    data: { name: 'Demo Manager', email: DEMO_USERS.manager, password: hashed, role: 'NORMAL', emailVerified: true },
  })
  const cashier = await prisma.user.create({
    data: { name: 'Demo Cashier', email: DEMO_USERS.cashier, password: hashed, role: 'NORMAL', emailVerified: true },
  })

  const shops = []
  for (const def of SHOPS) {
    shops.push(await seedShop(org.id, manager.id, def))
  }

  // Cashier limited to the first shop (Kiryana); manager already STORE_MANAGER on all.
  await prisma.userShop.create({ data: { userId: cashier.id, shopId: shops[0].id, shopRole: 'CASHIER' } })

  console.log('✅ Demo org seeded.')
  console.log(`   Org: ${org.name} (id=${org.id})`)
  console.log(`   Shops: ${shops.map((s) => s.name).join(', ')}`)
  console.log(`   Login password (all demo users): ${DEMO_PASSWORD}`)
  console.log(`   Org Admin:     ${DEMO_USERS.admin}`)
  console.log(`   Store Manager: ${DEMO_USERS.manager} (all shops)`)
  console.log(`   Cashier:       ${DEMO_USERS.cashier} (Kiryana only)`)
  return org
}

if (require.main === module) {
  seedDemoOrg()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (e) => {
      console.error(e)
      await prisma.$disconnect()
      process.exit(1)
    })
}
