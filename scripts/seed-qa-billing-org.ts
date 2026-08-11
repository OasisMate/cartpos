/**
 * Create an isolated QA organisation for testing the payment wall.
 *
 * WHY NOT THE DEMO ORG: `Organization.isDemo` bypasses billing before any check
 * runs (deliberately, so our own QA can never be locked out). A demo store will
 * therefore always look fully unlocked no matter what its subscription says,
 * which makes it useless for testing a paywall. This org is isDemo=FALSE on
 * purpose, so every gate applies to it exactly as it would to a real customer.
 *
 * Everything is namespaced `QA BILLING` and uses @cartpos.test addresses, which
 * cannot reach a real inbox. Tear it all down with delete-qa-billing-org.ts.
 *
 * Deliberately creates THREE shops and FOUR users so the downgrade picker and
 * the seat caps have something real to act on.
 *
 * Run: npx tsx scripts/seed-qa-billing-org.ts
 */
import { PrismaClient, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { QA_ORG_NAME, QA_PASSWORD, QA_USERS } from './billing-qa-constants'

const prisma = new PrismaClient()

const D = (n: number) => new Prisma.Decimal(n.toFixed(2))

const PRODUCTS = [
  { name: 'SUGAR 1KG', sku: 'QA-SUG-1', price: 210, cost: 185, stock: 120, unit: 'kg' },
  { name: 'COOKING OIL 5L', sku: 'QA-OIL-5', price: 2450, cost: 2180, stock: 40, unit: 'L' },
  { name: 'TEA PACK 190G', sku: 'QA-TEA-190', price: 640, cost: 560, stock: 75, unit: 'pack' },
  { name: 'RICE BASMATI 5KG', sku: 'QA-RIC-5', price: 1850, cost: 1620, stock: 30, unit: 'kg' },
  { name: 'SOAP BAR', sku: 'QA-SOAP-1', price: 120, cost: 95, stock: 200, unit: 'pcs' },
]

const CUSTOMERS = [
  { name: 'QA WALK-IN', phone: null },
  { name: 'QA ALI TRADERS', phone: '03330000001' },
  { name: 'QA BILAL KHAN', phone: '03330000002' },
]

// Busiest first, so the downgrade picker's "keep the busiest" default is
// actually exercised rather than trivially correct.
const SHOPS = [
  { name: 'QA MAIN STORE', city: 'Lahore', sales: 6 },
  { name: 'QA SECOND BRANCH', city: 'Sialkot', sales: 3 },
  { name: 'QA THIRD BRANCH', city: 'Gujranwala', sales: 1 },
]

async function main() {
  const existing = await prisma.organization.findFirst({ where: { name: QA_ORG_NAME } })
  if (existing) {
    console.log(`${QA_ORG_NAME} already exists (${existing.id}).`)
    console.log('Run scripts/delete-qa-billing-org.ts first if you want a clean one.')
    return
  }

  const hashed = await bcrypt.hash(QA_PASSWORD, 12)

  const org = await prisma.organization.create({
    data: {
      name: QA_ORG_NAME,
      legalName: QA_ORG_NAME,
      type: 'GENERAL_STORE',
      city: 'Lahore',
      phone: '03330000000',
      status: 'ACTIVE',
      // The whole point: billing must apply to this org.
      isDemo: false,
      referralSource: 'QA seed',
    },
  })

  const owner = await prisma.user.create({
    data: {
      name: 'QA Owner',
      email: QA_USERS.owner,
      phone: '03330000010',
      password: hashed,
      role: 'NORMAL',
      emailVerified: true,
      organizations: { create: { orgId: org.id, orgRole: 'ORG_ADMIN' } },
    },
  })

  const manager = await prisma.user.create({
    data: {
      name: 'QA Manager',
      email: QA_USERS.manager,
      phone: '03330000011',
      password: hashed,
      role: 'NORMAL',
      emailVerified: true,
    },
  })

  const cashier1 = await prisma.user.create({
    data: {
      name: 'QA Cashier One',
      email: QA_USERS.cashier1,
      phone: '03330000012',
      password: hashed,
      role: 'NORMAL',
      emailVerified: true,
    },
  })

  const cashier2 = await prisma.user.create({
    data: {
      name: 'QA Cashier Two',
      email: QA_USERS.cashier2,
      phone: '03330000013',
      password: hashed,
      role: 'NORMAL',
      emailVerified: true,
    },
  })

  const shopIds: string[] = []

  for (const spec of SHOPS) {
    const shop = await prisma.shop.create({
      data: { orgId: org.id, name: spec.name, city: spec.city, phone: '03330000000' },
    })
    shopIds.push(shop.id)

    await prisma.shopSettings.create({
      data: {
        shopId: shop.id,
        allowCustomUnits: true,
        allowNegativeStock: true,
        enableQuotations: true,
        enableTradePricing: true,
        featureConfig: { batchExpiry: false, units: ['pcs', 'kg', 'L', 'pack', 'box'] },
      },
    })

    // Owner manages every shop; that is what makes the downgrade picker matter.
    await prisma.userShop.create({
      data: { userId: owner.id, shopId: shop.id, shopRole: 'STORE_MANAGER' },
    })

    const products = []
    for (const p of PRODUCTS) {
      const product = await prisma.product.create({
        data: {
          shopId: shop.id,
          name: p.name,
          sku: `${p.sku}-${shopIds.length}`,
          unit: p.unit,
          price: D(p.price),
          costPrice: D(p.cost),
          trackStock: true,
        },
      })
      // Stock is a ledger, not a column: opening balance goes in as a movement.
      await prisma.stockLedger.create({
        data: {
          shopId: shop.id,
          productId: product.id,
          changeQty: D(p.stock),
          type: 'ADJUSTMENT',
          refType: 'qa_seed_opening',
        },
      })
      products.push(product)
    }

    const customers = []
    for (const c of CUSTOMERS) {
      customers.push(
        await prisma.customer.create({
          data: {
            shopId: shop.id,
            name: c.name,
            phone: c.phone ? `${c.phone.slice(0, -1)}${shopIds.length}` : null,
          },
        })
      )
    }

    // A little sales history so reports have something to show and the
    // "busiest shop" ordering in the downgrade picker is meaningful.
    for (let i = 0; i < spec.sales; i++) {
      const product = products[i % products.length]
      const qty = 1 + (i % 3)
      const lineTotal = Number(product.price) * qty

      const invoice = await prisma.invoice.create({
        data: {
          shopId: shop.id,
          number: `QA-${shopIds.length}-${1000 + i}`,
          customerId: customers[i % customers.length].id,
          createdByUserId: owner.id,
          subtotal: D(lineTotal),
          discount: D(0),
          total: D(lineTotal),
          paymentStatus: 'PAID',
          lines: {
            create: [
              {
                productId: product.id,
                quantity: D(qty),
                unitPrice: product.price,
                lineTotal: D(lineTotal),
              },
            ],
          },
        },
      })

      // Keep the ledger honest so stock figures in reports are not nonsense.
      await prisma.stockLedger.create({
        data: {
          shopId: shop.id,
          productId: product.id,
          changeQty: D(-qty),
          type: 'SALE',
          refType: 'invoice',
          refId: invoice.id,
        },
      })
    }
  }

  // Staff on the main shop only. Four distinct users total, so Solo (1 user)
  // and Team (3 users, 2 cashiers) both have something to refuse.
  await prisma.userShop.create({
    data: { userId: manager.id, shopId: shopIds[0], shopRole: 'STORE_MANAGER' },
  })
  await prisma.userShop.create({
    data: { userId: cashier1.id, shopId: shopIds[0], shopRole: 'CASHIER' },
  })
  await prisma.userShop.create({
    data: { userId: cashier2.id, shopId: shopIds[0], shopRole: 'CASHIER' },
  })

  // Start it exactly where a real signup starts.
  const plan = await prisma.plan.findUnique({ where: { code: 'BUSINESS' } })
  if (!plan) {
    console.error('Plans are not seeded. Run scripts/seed-billing-plans.ts first.')
    process.exit(1)
  }

  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      planId: plan.id,
      status: 'TRIALING',
      cycle: 'MONTHLY',
      agreedMonthlyPrice: plan.monthlyPrice,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      currentPeriodEnd: null,
    },
  })

  console.log(`Created ${QA_ORG_NAME} (${org.id})`)
  console.log(`  shops:    ${SHOPS.map((s) => s.name).join(', ')}`)
  console.log(`  users:    ${Object.values(QA_USERS).join(', ')}`)
  console.log(`  password: ${QA_PASSWORD}`)
  console.log(`  plan:     BUSINESS, trialing, 14 days`)
  console.log(`\nSet its state with:  npx tsx scripts/qa-billing-state.ts <state>`)
  console.log(`Tear it down with:   npx tsx scripts/delete-qa-billing-org.ts`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
