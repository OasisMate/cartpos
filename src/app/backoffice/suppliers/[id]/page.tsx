import { getCurrentUser } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupplierLedger } from '@/lib/domain/suppliers'
import { formatCurrency } from '@/lib/utils/money'

function entryLabel(type: string) {
  switch (type) {
    case 'PAYMENT_MADE':
      return 'Payment'
    case 'PURCHASE_CREDIT':
      return 'Purchase (credit)'
    case 'OPENING_BALANCE':
      return 'Opening balance'
    default:
      return 'Adjustment'
  }
}

export default async function SupplierDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  let data
  try {
    data = await getSupplierLedger(params.id, user.id)
  } catch {
    return notFound()
  }

  const { supplier, balance, entries } = data
  const totalPaid = entries
    .filter((e) => e.type === 'PAYMENT_MADE')
    .reduce((sum, e) => sum + e.amount, 0)
  const lastPayment = entries.find((e) => e.type === 'PAYMENT_MADE')

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">{supplier.name}</h1>
          <p className="text-[hsl(var(--muted-foreground))]">
            {supplier.phone || '—'}
            {supplier.notes && (
              <>
                {' · '}
                <span className="italic">{supplier.notes}</span>
              </>
            )}
          </p>
        </div>
        <Link href="/store/suppliers" className="btn btn-outline h-9 px-4">
          Back to Suppliers
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-body space-y-2">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Balance Payable</div>
            <div
              className={`text-2xl font-semibold ${
                balance > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {formatCurrency(balance)}
            </div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {balance > 0 ? 'You owe this amount to the supplier.' : 'Nothing outstanding.'}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body space-y-1">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">Total Paid</div>
            <div className="text-xl font-semibold text-emerald-700">{formatCurrency(totalPaid)}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {lastPayment
                ? `Last payment: ${new Date(lastPayment.createdAt).toLocaleDateString()}`
                : 'No payments recorded yet.'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Make Payment</h2>
            <form
              action={`/api/suppliers/${supplier.id}/payment`}
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
              <button className="btn btn-primary h-9 px-4 whitespace-nowrap">Make Payment</button>
            </form>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold mb-3">Add Opening / Owed Amount</h2>
            <form
              action={`/api/suppliers/${supplier.id}/credit`}
              method="post"
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Amount owed"
                className="input h-9 sm:w-40"
                required
              />
              <input
                name="note"
                className="input h-9 flex-1"
                placeholder="Optional note (e.g. opening balance)"
              />
              <button className="btn btn-outline h-9 px-4 whitespace-nowrap border-dashed border-2 border-orange-400 text-orange-700 hover:bg-orange-50 hover:border-orange-500 font-semibold">
                Add Owed
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="font-semibold mb-3">Ledger</h2>
          {entries.length === 0 ? (
            <div className="text-sm text-[hsl(var(--muted-foreground))]">No transactions yet.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span>{new Date(e.createdAt).toLocaleString()}</span>
                    {e.note && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">{e.note}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wide ${
                        e.direction === 'DEBIT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-orange-50 text-orange-700 border border-orange-100'
                      }`}
                    >
                      {entryLabel(e.type)}
                    </span>
                    <span className="font-semibold">
                      {e.direction === 'DEBIT' ? '-' : '+'}
                      {formatCurrency(e.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
