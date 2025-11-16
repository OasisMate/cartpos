import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'

async function getData(customerId: string, userId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
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

  // Balance = DEBIT - CREDIT
  const [debits, credits] = await Promise.all([
    prisma.customerLedger.aggregate({
      _sum: { amount: true },
      where: { customerId, direction: 'DEBIT' },
    }),
    prisma.customerLedger.aggregate({
      _sum: { amount: true },
      where: { customerId, direction: 'CREDIT' },
    }),
  ])
  const balance = Number(debits._sum.amount || 0) - Number(credits._sum.amount || 0)
  return { customer, balance }
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

  const { customer, balance } = data

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">{customer.name}</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-6">{customer.phone || '—'}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Outstanding Balance</div>
            <div className="text-2xl font-semibold">{balance.toFixed(2)}</div>
          </div>
        </div>
        <div className="card md:col-span-2">
          <div className="card-body">
            <form action={`/api/customers/${customer.id}/udhaar-payment`} method="post" className="flex gap-2">
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Payment amount"
                className="input h-9 w-40"
                required
              />
              <select name="method" className="input h-9 w-40">
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
              <input name="note" className="input h-9 flex-1" placeholder="Optional note" />
              <button className="btn btn-primary h-9 px-4">Receive Payment</button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Recent Udhaar Entries</h2>
            <ul className="space-y-2 text-sm">
              {customer.ledger.map((l) => (
                <li key={l.id} className="flex justify-between">
                  <span>{new Date(l.createdAt).toLocaleString()}</span>
                  <span>
                    {l.direction} {Number(l.amount).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Recent Invoices</h2>
            <ul className="space-y-2 text-sm">
              {customer.invoices.map((inv) => (
                <li key={inv.id} className="flex justify-between">
                  <span>{new Date(inv.createdAt).toLocaleString()}</span>
                  <span>{Number(inv.total).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}


