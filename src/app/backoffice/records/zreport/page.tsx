import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { canViewReports } from '@/lib/permissions'
import { getShopTimezone } from '@/lib/db/shop-timezone'
import { getZReport } from '@/lib/domain/zreport'
import { formatCurrency } from '@/lib/utils/money'
import PrintButton from '@/components/suppliers/PrintButton'
import ZReportShareButton from '@/components/reports/ZReportShareButton'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default async function ZReportPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.currentShopId) redirect('/select-shop')
  if (!canViewReports(user, user.currentShopId)) redirect('/store')

  const date = searchParams.date || todayISO()
  const timezone = await getShopTimezone(user.currentShopId)
  const z = await getZReport(user.currentShopId, date, timezone)
  const generatedAt = new Date()

  const Row = ({ label, value, strong, danger, positive }: { label: string; value: number; strong?: boolean; danger?: boolean; positive?: boolean }) => (
    <tr className={strong ? 'border-t-2 border-black' : 'border-b border-gray-200'}>
      <td className={`py-1.5 ${strong ? 'font-bold' : ''}`}>{label}</td>
      <td className={`py-1.5 text-right ${strong ? 'font-bold' : 'font-medium'} ${danger ? 'text-red-700' : positive ? 'text-emerald-700' : ''}`}>
        {formatCurrency(value)}
      </td>
    </tr>
  )

  return (
    <div className="p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #z-report, #z-report * { visibility: visible; }
          #z-report { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
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
            <span className="block text-xs text-[hsl(var(--muted-foreground))]">Day</span>
            <input type="date" name="date" defaultValue={date} className="input h-9" />
          </label>
          <button type="submit" className="btn btn-outline h-9 px-4">
            Apply
          </button>
        </form>
        <div className="flex items-center gap-2">
          <ZReportShareButton report={z} />
          <PrintButton />
        </div>
      </div>

      <div id="z-report" className="mx-auto max-w-2xl bg-white text-black">
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <div className="text-xl font-bold">{z.shopName || 'Day Close'}</div>
            <div className="text-sm">End-of-Day Report (Z-Report)</div>
          </div>
          <div className="text-right text-sm font-medium">{z.date}</div>
        </div>

        {/* Sales */}
        <div className="text-sm font-bold mb-1">Sales</div>
        <table className="w-full text-sm border-collapse mb-5">
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-1.5">Total sales</td>
              <td className="py-1.5 text-right font-medium">
                {formatCurrency(z.totalSales)} <span className="text-gray-500 font-normal">({z.totalInvoices} bills)</span>
              </td>
            </tr>
            <Row label="Cash sales" value={z.salesByMethod.cash} />
            <Row label="Card sales" value={z.salesByMethod.card} />
            {z.salesByMethod.other > 0 && <Row label="Other" value={z.salesByMethod.other} />}
            <Row label="Udhaar (credit) sales" value={z.salesByMethod.udhaar} danger />
          </tbody>
        </table>

        {/* Cash drawer */}
        <div className="text-sm font-bold mb-1">Cash drawer</div>
        <table className="w-full text-sm border-collapse mb-5">
          <tbody>
            <Row label="Cash in (sales + udhaar received)" value={z.cashIn} positive />
            <tr className="border-b border-gray-200">
              <td className="py-1.5 pl-4 text-gray-600">Refunds out</td>
              <td className="py-1.5 text-right">{formatCurrency(z.cashOutBreakdown.refunds)}</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-1.5 pl-4 text-gray-600">Supplier payments</td>
              <td className="py-1.5 text-right">{formatCurrency(z.cashOutBreakdown.supplierPayments)}</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-1.5 pl-4 text-gray-600">Expenses</td>
              <td className="py-1.5 text-right">{formatCurrency(z.cashOutBreakdown.expenses)}</td>
            </tr>
            <Row label="Cash out (total)" value={z.cashOut} danger />
            <Row label="Net cash movement" value={z.cashNet} strong />
          </tbody>
        </table>

        {/* Receivables + profit */}
        <div className="text-sm font-bold mb-1">Receivables & profit</div>
        <table className="w-full text-sm border-collapse mb-5">
          <tbody>
            <Row label="Udhaar given today" value={z.udhaarGiven} danger />
            <Row label="Payments received today" value={z.paymentsReceived} positive />
            <Row label="Cost of goods" value={z.costOfGoods} />
            <Row label="Gross profit" value={z.grossProfit} strong positive={z.grossProfit >= 0} danger={z.grossProfit < 0} />
          </tbody>
        </table>

        {z.returnsCount > 0 && (
          <>
            <div className="text-sm font-bold mb-1">Returns / refunds</div>
            <table className="w-full text-sm border-collapse mb-5">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-1.5">Returns processed</td>
                  <td className="py-1.5 text-right font-medium">{z.returnsCount}</td>
                </tr>
                <Row label="Net refund value" value={z.returnsRefundValue} />
              </tbody>
            </table>
          </>
        )}

        <div className="mt-6 text-xs text-gray-600">
          Generated by CartPOS on {generatedAt.toLocaleString()}.
        </div>
      </div>
    </div>
  )
}
