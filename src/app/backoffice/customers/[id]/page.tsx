import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import CustomerInvoicesCard from '@/components/customers/CustomerInvoicesCard'
import UdhaarReminderButton from '@/components/customers/UdhaarReminderButton'
import { formatCurrency } from '@/lib/utils/money'

async function getData(customerId: string, userId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      shop: { select: { name: true } },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      ledger: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })
  if (!customer) return null

  // Balance = DEBIT - CREDIT (all credits reduce what's owed, incl. void reversals).
  // "Payments received" must count only actual payments (type PAYMENT_RECEIVED) -
  // void/opening adjustments are credits too but are NOT money received.
  const [debits, credits, payments, lastPayment] = await Promise.all([
    prisma.customerLedger.aggregate({
      _sum: { amount: true },
      where: { customerId, direction: 'DEBIT' },
    }),
    prisma.customerLedger.aggregate({
      _sum: { amount: true },
      where: { customerId, direction: 'CREDIT' },
    }),
    prisma.customerLedger.aggregate({
      _sum: { amount: true },
      where: { customerId, type: 'PAYMENT_RECEIVED' },
    }),
    prisma.customerLedger.findFirst({
      where: { customerId, type: 'PAYMENT_RECEIVED' },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const balance = Number(debits._sum.amount || 0) - Number(credits._sum.amount || 0)
  const totalInvoiced = customer.invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0)
  const totalPaid = Number(payments._sum.amount || 0)
  const lastInvoiceAt = customer.invoices[0]?.createdAt ?? null
  const lastPaymentAt = lastPayment?.createdAt ?? null

  return { customer, balance, totalInvoiced, totalPaid, lastInvoiceAt, lastPaymentAt }
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const data = await getData(params.id, user.id)
  if (!data) return notFound()

  const { customer, balance, totalInvoiced, totalPaid, lastInvoiceAt, lastPaymentAt } = data

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">{customer.name}</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            {customer.phone || '-'}
            {customer.notes && (
              <>
                {' · '}
                <span className="italic">{customer.notes}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {balance > 0 && (
            <UdhaarReminderButton
              name={customer.name}
              phone={customer.phone}
              balance={balance}
              shopName={customer.shop?.name}
            />
          )}
          <Link
            href={`/store/customers/${customer.id}/statement`}
            className="btn btn-outline h-9 px-4"
          >
            Print Statement
          </Link>
          <Link href="/store/customers" className="btn btn-outline h-9 px-4">
            Back to Customers
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body space-y-2">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Outstanding Balance</div>
            <div
              className={`text-2xl font-semibold ${
                balance > 0 ? 'text-red-600' : balance < 0 ? 'text-emerald-600' : 'text-emerald-600'
              }`}
            >
              {formatCurrency(balance)}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {balance > 0 ? 'Customer owes you this amount.' : 'No outstanding udhaar.'}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body space-y-1">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Udhaar Given</div>
            <div className="text-xl font-semibold">{formatCurrency(totalInvoiced)}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {lastInvoiceAt ? `Last invoice: ${new Date(lastInvoiceAt).toLocaleDateString()}` : 'No invoices yet.'}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body space-y-1">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Payments Received</div>
            <div className="text-xl font-semibold text-emerald-700">{formatCurrency(totalPaid)}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {lastPaymentAt
                ? `Last payment: ${new Date(lastPaymentAt).toLocaleDateString()}`
                : 'No payments recorded yet.'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Receive Payment</h2>
            <form
              action={`/api/customers/${customer.id}/udhaar-payment`}
              method="post"
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Payment amount"
                className="input h-9 sm:w-40"
                required
              />
              <select name="method" className="input h-9 sm:w-32">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
              <input name="note" className="input h-9 flex-1" placeholder="Optional note (e.g. slip no.)" />
              <button className="btn btn-primary h-9 px-4 whitespace-nowrap">Receive Payment</button>
            </form>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Add Opening / Adjust Balance</h2>
            <form
              action={`/api/customers/${customer.id}/opening-balance`}
              method="post"
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Opening / adjustment amount"
                className="input h-9 sm:w-40"
                required
              />
              <input
                name="note"
                className="input h-9 flex-1"
                placeholder="Optional note (e.g. opening balance)"
              />
              <button className="btn btn-outline h-9 px-4 whitespace-nowrap border-dashed border-2 border-orange-400 text-orange-700 hover:bg-orange-50 hover:border-orange-500 font-semibold">
                Add Opening / Adjust
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Recent Udhaar Entries</h2>
            {customer.ledger.length === 0 ? (
              <div className="text-sm text-[hsl(var(--muted-foreground))]">No udhaar history yet.</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {customer.ledger.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span>{new Date(l.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wide ${
                          l.direction === 'CREDIT'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-orange-50 text-orange-700 border border-orange-100'
                        }`}
                      >
                        {l.type === 'PAYMENT_RECEIVED' ? 'Payment' : l.type === 'SALE_UDHAAR' ? 'Udhaar' : 'Adjustment'}
                      </span>
                      <span className="font-semibold">
                        {l.direction === 'CREDIT' ? '-' : '+'}
                        {formatCurrency(Number(l.amount))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <CustomerInvoicesCard
          invoices={customer.invoices.map((inv) => ({
            id: inv.id,
            createdAt: inv.createdAt.toISOString(),
            total: Number(inv.total),
            invoiceNumber: (inv as any).number ?? (inv as any).invoiceNumber ?? null,
          }))}
        />
      </div>
    </div>
  )
}


