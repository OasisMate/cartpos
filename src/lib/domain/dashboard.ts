import { prisma } from '@/lib/db/prisma'
import { DEFAULT_TIMEZONE, shopTodayYMD, startOfShopDayUTC, shopDayStartUTC } from '@/lib/utils/timezone'
import { getDailySummary, type DailySummary } from './reports'
import { getProductStockBatch } from './purchases'

export interface TrendPoint {
  ymd: string
  sales: number
}
export interface LowStockItem {
  id: string
  name: string
  onHand: number
  reorderLevel: number
}
export interface TopProduct {
  name: string
  qty: number
  revenue: number
}
export interface RecentSale {
  id: string
  createdAt: string
  total: number
  paymentStatus: string
  customerName: string | null
}

export interface ManagerDashboard {
  today: DailySummary
  yesterday: DailySummary
  trend: TrendPoint[]
  receivables: number
  payables: number
  lowStock: LowStockItem[]
  lowStockCount: number
  topProducts: TopProduct[]
  recentSales: RecentSale[]
}

export interface CashierDashboard {
  totalSales: number
  totalInvoices: number
  totalUdhaar: number
  totalPaymentsReceived: number
  recentSales: RecentSale[]
}

export interface OrgStoreToday {
  shopId: string
  name: string
  sales: number
  invoices: number
}

/** The last `n` shop-local calendar days (oldest → newest), as YYYY-MM-DD. */
function lastNDaysYMD(timezone: string, n: number): string[] {
  const [y, m, d] = shopTodayYMD(timezone).split('-').map(Number)
  const base = Date.UTC(y, m - 1, d)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(base - i * 86400000)
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
    )
  }
  return out
}

function mapRecentSales(
  rows: Array<{ id: string; createdAt: Date; total: any; paymentStatus: string; customer: { name: string } | null }>
): RecentSale[] {
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    total: Number(r.total),
    paymentStatus: r.paymentStatus,
    customerName: r.customer?.name ?? null,
  }))
}

export async function getManagerDashboard(
  shopId: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<ManagerDashboard> {
  const days = lastNDaysYMD(timezone, 7)
  const todayYMD = days[days.length - 1]
  const yesterdayYMD = days[days.length - 2]
  const weekStart = startOfShopDayUTC(timezone, days[0])

  const [
    today,
    yesterday,
    trendRows,
    custDebit,
    custCredit,
    supCredit,
    supDebit,
    trackedProducts,
    weekLines,
    recentRows,
  ] = await Promise.all([
    getDailySummary(shopId, todayYMD, timezone),
    getDailySummary(shopId, yesterdayYMD, timezone),
    prisma.invoice.findMany({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: weekStart } },
      select: { total: true, createdAt: true },
    }),
    prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { shopId, direction: 'DEBIT' } }),
    prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { shopId, direction: 'CREDIT' } }),
    prisma.supplierLedger.aggregate({ _sum: { amount: true }, where: { shopId, direction: 'CREDIT' } }),
    prisma.supplierLedger.aggregate({ _sum: { amount: true }, where: { shopId, direction: 'DEBIT' } }),
    prisma.product.findMany({
      where: { shopId, trackStock: true, reorderLevel: { not: null }, archivedAt: null },
      select: { id: true, name: true, reorderLevel: true },
    }),
    prisma.invoiceLine.findMany({
      where: { invoice: { shopId, status: 'COMPLETED', createdAt: { gte: weekStart } }, product: { archivedAt: null } },
      select: { quantity: true, lineTotal: true, productId: true, product: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { shopId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, createdAt: true, total: true, paymentStatus: true, customer: { select: { name: true } } },
    }),
  ])

  // 7-day sales trend bucketed by shop-local day.
  const salesByDay = new Map<string, number>()
  for (const inv of trendRows) {
    const ymd = shopTodayYMD(timezone, inv.createdAt)
    salesByDay.set(ymd, (salesByDay.get(ymd) || 0) + Number(inv.total))
  }
  const trend: TrendPoint[] = days.map((ymd) => ({ ymd, sales: Math.round((salesByDay.get(ymd) || 0) * 100) / 100 }))

  const receivables = Math.max(0, Number(custDebit._sum.amount || 0) - Number(custCredit._sum.amount || 0))
  const payables = Math.max(0, Number(supCredit._sum.amount || 0) - Number(supDebit._sum.amount || 0))

  // Low stock: on-hand at or below reorder level.
  const stockMap = await getProductStockBatch(shopId, trackedProducts.map((p) => p.id))
  const lowAll = trackedProducts
    .map((p) => ({ id: p.id, name: p.name, onHand: stockMap.get(p.id) ?? 0, reorderLevel: Number(p.reorderLevel) }))
    .filter((p) => p.onHand <= p.reorderLevel)
    .sort((a, b) => b.reorderLevel - b.onHand - (a.reorderLevel - a.onHand))
  const lowStock = lowAll.slice(0, 6)

  // Top products this week by units sold (sales volume).
  // Grouped by productId, not name: distinct products can share a name and
  // must not be merged into one inflated row.
  const byProduct = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const l of weekLines) {
    const cur = byProduct.get(l.productId) || { name: l.product.name, qty: 0, revenue: 0 }
    cur.qty += Number(l.quantity)
    cur.revenue += Number(l.lineTotal)
    byProduct.set(l.productId, cur)
  }
  const topProducts: TopProduct[] = Array.from(byProduct.values())
    .map((v) => ({ name: v.name, qty: Math.round(v.qty * 1000) / 1000, revenue: Math.round(v.revenue * 100) / 100 }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue)
    .slice(0, 5)

  return {
    today,
    yesterday,
    trend,
    receivables,
    payables,
    lowStock,
    lowStockCount: lowAll.length,
    topProducts,
    recentSales: mapRecentSales(recentRows),
  }
}

export async function getCashierDashboard(
  shopId: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<CashierDashboard> {
  const start = shopDayStartUTC(timezone)

  const [invoices, payments, udhaar, recentRows] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      _count: { _all: true },
      where: { shopId, status: 'COMPLETED', createdAt: { gte: start } },
    }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { shopId, createdAt: { gte: start } } }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { shopId, status: 'COMPLETED', paymentStatus: 'UDHAAR', createdAt: { gte: start } },
    }),
    prisma.invoice.findMany({
      where: { shopId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, createdAt: true, total: true, paymentStatus: true, customer: { select: { name: true } } },
    }),
  ])

  return {
    totalSales: Number(invoices._sum.total || 0),
    totalInvoices: invoices._count._all || 0,
    totalUdhaar: Number(udhaar._sum.total || 0),
    totalPaymentsReceived: Number(payments._sum.amount || 0),
    recentSales: mapRecentSales(recentRows),
  }
}

export interface OrgDashboard {
  shopsCount: number
  usersCount: number
  productsCount: number
  customersCount: number
  salesToday: number
  invoicesToday: number
  paymentsToday: number
  receivables: number
  perStore: OrgStoreToday[]
  trend: TrendPoint[]
}

/** Consolidated org-wide dashboard for an owner / platform admin. */
export async function getOrgDashboard(
  orgId: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<OrgDashboard> {
  const days = lastNDaysYMD(timezone, 7)
  const weekStart = startOfShopDayUTC(timezone, days[0])
  const todayStart = shopDayStartUTC(timezone)

  const shops = await prisma.shop.findMany({ where: { orgId }, select: { id: true, name: true } })
  const shopIds = shops.map((s) => s.id)

  if (shopIds.length === 0) {
    const orgUsers = await prisma.organizationUser.findMany({ where: { orgId }, select: { userId: true } })
    return {
      shopsCount: 0,
      usersCount: new Set(orgUsers.map((u) => u.userId)).size,
      productsCount: 0,
      customersCount: 0,
      salesToday: 0,
      invoicesToday: 0,
      paymentsToday: 0,
      receivables: 0,
      perStore: [],
      trend: days.map((ymd) => ({ ymd, sales: 0 })),
    }
  }

  const [orgUsers, shopUsers, productsCount, customersCount, invToday, payToday, custDebit, custCredit, perStoreGroup, trendRows] =
    await Promise.all([
      prisma.organizationUser.findMany({ where: { orgId }, select: { userId: true } }),
      prisma.userShop.findMany({ where: { shopId: { in: shopIds } }, select: { userId: true } }),
      prisma.product.count({ where: { shopId: { in: shopIds } } }),
      prisma.customer.count({ where: { shopId: { in: shopIds } } }),
      prisma.invoice.aggregate({
        _sum: { total: true },
        _count: { _all: true },
        where: { shopId: { in: shopIds }, status: 'COMPLETED', createdAt: { gte: todayStart } },
      }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { shopId: { in: shopIds }, createdAt: { gte: todayStart } } }),
      prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { shopId: { in: shopIds }, direction: 'DEBIT' } }),
      prisma.customerLedger.aggregate({ _sum: { amount: true }, where: { shopId: { in: shopIds }, direction: 'CREDIT' } }),
      prisma.invoice.groupBy({
        by: ['shopId'],
        where: { shopId: { in: shopIds }, status: 'COMPLETED', createdAt: { gte: todayStart } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.invoice.findMany({
        where: { shopId: { in: shopIds }, status: 'COMPLETED', createdAt: { gte: weekStart } },
        select: { total: true, createdAt: true },
      }),
    ])

  // Distinct people with access to the org = org-level admins + shop-level staff.
  const usersCount = new Set([...orgUsers.map((u) => u.userId), ...shopUsers.map((u) => u.userId)]).size

  const byShop = new Map(perStoreGroup.map((g) => [g.shopId, g]))
  const perStore: OrgStoreToday[] = shops
    .map((s) => {
      const g = byShop.get(s.id)
      return { shopId: s.id, name: s.name, sales: Number(g?._sum.total || 0), invoices: g?._count._all || 0 }
    })
    .sort((a, b) => b.sales - a.sales)

  const salesByDay = new Map<string, number>()
  for (const inv of trendRows) {
    const ymd = shopTodayYMD(timezone, inv.createdAt)
    salesByDay.set(ymd, (salesByDay.get(ymd) || 0) + Number(inv.total))
  }
  const trend: TrendPoint[] = days.map((ymd) => ({ ymd, sales: Math.round((salesByDay.get(ymd) || 0) * 100) / 100 }))

  return {
    shopsCount: shops.length,
    usersCount,
    productsCount,
    customersCount,
    salesToday: Number(invToday._sum.total || 0),
    invoicesToday: invToday._count._all || 0,
    paymentsToday: Number(payToday._sum.amount || 0),
    receivables: Math.max(0, Number(custDebit._sum.amount || 0) - Number(custCredit._sum.amount || 0)),
    perStore,
    trend,
  }
}

/** Per-store sales today for an org owner overseeing multiple shops. */
export async function getOrgStoresToday(
  orgId: string,
  timezone: string = DEFAULT_TIMEZONE
): Promise<OrgStoreToday[]> {
  const start = shopDayStartUTC(timezone)
  const shops = await prisma.shop.findMany({
    where: { orgId },
    select: { id: true, name: true },
  })
  if (shops.length === 0) return []

  const grouped = await prisma.invoice.groupBy({
    by: ['shopId'],
    where: { shopId: { in: shops.map((s) => s.id) }, status: 'COMPLETED', createdAt: { gte: start } },
    _sum: { total: true },
    _count: { _all: true },
  })
  const byShop = new Map(grouped.map((g) => [g.shopId, g]))

  return shops
    .map((s) => {
      const g = byShop.get(s.id)
      return {
        shopId: s.id,
        name: s.name,
        sales: Number(g?._sum.total || 0),
        invoices: g?._count._all || 0,
      }
    })
    .sort((a, b) => b.sales - a.sales)
}
