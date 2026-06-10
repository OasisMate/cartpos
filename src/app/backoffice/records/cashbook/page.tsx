import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { canViewReports } from '@/lib/permissions'
import { getShopTimezone } from '@/lib/db/shop-timezone'
import { getCashBook, type CashBookRow } from '@/lib/domain/cashbook'
import { formatCurrency } from '@/lib/utils/money'
import PrintButton from '@/components/suppliers/PrintButton'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function CashBookPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.currentShopId) redirect('/select-shop')
  if (!canViewReports(user, user.currentShopId)) redirect('/store')

  const from = searchParams.from || todayISO()
  const to = searchParams.to || from

  const timezone = await getShopTimezone(user.currentShopId)
  const book = await getCashBook(user.currentShopId, from, to, timezone)
  const generatedAt = new Date()

  const renderRows = (rows: CashBookRow[]) =>
    rows.length === 0 ? (
      <tr>
        <td colSpan={3} className="py-3 text-center">
          None
        </td>
      </tr>
    ) : (
      rows.map((r) => (
        <tr key={r.id} className="border-b border-gray-300">
          <td className="py-1.5">{new Date(r.date).toLocaleDateString()}</td>
          <td className="py-1.5">
            {r.label}
            {r.ref ? ` ${r.ref}` : ''}
          </td>
          <td className="text-right py-1.5 font-medium">{formatCurrency(r.amount)}</td>
        </tr>
      ))
    )

  return (
    <div className="p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #cash-book, #cash-book * { visibility: visible; }
          #cash-book { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <Link href="/store/reports" className="btn btn-outline h-9 px-4">
          Back
        </Link>
        <form method="get" className="flex items-end gap-2">
          <label className="text-sm">
            <span className="block text-xs text-[hsl(var(--muted-foreground))]">From</span>
            <input type="date" name="from" defaultValue={from} className="input h-9" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-[hsl(var(--muted-foreground))]">To</span>
            <input type="date" name="to" defaultValue={to} className="input h-9" />
          </label>
          <button type="submit" className="btn btn-outline h-9 px-4">
            Apply
          </button>
        </form>
        <PrintButton />
      </div>

      <div id="cash-book" className="mx-auto max-w-3xl bg-white text-black">
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <div className="text-xl font-bold">{book.shopName || 'Cash Book'}</div>
            <div className="text-sm">Cash Book (روزنامچہ)</div>
          </div>
          <div className="text-right text-sm">
            <div>
              {from === to ? from : `${from} → ${to}`}
            </div>
          </div>
        </div>

        <div className="text-sm font-bold mb-1">Cash In</div>
        <table className="w-full text-sm border-collapse mb-5">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-1.5">Date</th>
              <th className="text-left py-1.5">Description</th>
              <th className="text-right py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>{renderRows(book.inflows)}</tbody>
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={2} className="py-2 text-right font-bold">
                Total In
              </td>
              <td className="py-2 text-right font-bold">{formatCurrency(book.totals.in)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="text-sm font-bold mb-1">Cash Out</div>
        <table className="w-full text-sm border-collapse mb-5">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-1.5">Date</th>
              <th className="text-left py-1.5">Description</th>
              <th className="text-right py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>{renderRows(book.outflows)}</tbody>
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={2} className="py-2 text-right font-bold">
                Total Out
              </td>
              <td className="py-2 text-right font-bold">{formatCurrency(book.totals.out)}</td>
            </tr>
          </tfoot>
        </table>

        <table className="w-full text-sm border-collapse">
          <tfoot>
            <tr className="border-t-2 border-black">
              <td className="py-2 text-right font-bold">Net Cash Movement</td>
              <td className="py-2 text-right font-bold w-32">{formatCurrency(book.totals.net)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-6 text-xs text-gray-600">
          Generated by CartPOS on {generatedAt.toLocaleString()}.
        </div>
      </div>
    </div>
  )
}
