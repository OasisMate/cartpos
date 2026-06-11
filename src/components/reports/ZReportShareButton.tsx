'use client'

import { MessageCircle } from 'lucide-react'
import { formatNumber } from '@/lib/utils/money'
import type { ZReport } from '@/lib/domain/zreport'

/**
 * Shares the day's close as a plain WhatsApp text summary (no public link — this
 * is an internal owner/partner summary, not a customer receipt). Owner picks the recipient.
 */
export default function ZReportShareButton({ report }: { report: ZReport }) {
  function handleShare() {
    const m = report.salesByMethod
    const lines = [
      `${report.shopName || 'Shop'} — Day close`,
      report.date,
      '',
      `Sales: Rs.${formatNumber(report.totalSales)} (${report.totalInvoices} bills)`,
      `  Cash Rs.${formatNumber(m.cash)} | Card Rs.${formatNumber(m.card)} | Udhaar Rs.${formatNumber(m.udhaar)}`,
      '',
      `Cash in: Rs.${formatNumber(report.cashIn)}`,
      `Cash out: Rs.${formatNumber(report.cashOut)}`,
      `Net cash: Rs.${formatNumber(report.cashNet)}`,
      '',
      `Udhaar given: Rs.${formatNumber(report.udhaarGiven)}`,
      `Payments received: Rs.${formatNumber(report.paymentsReceived)}`,
      `Gross profit: Rs.${formatNumber(report.grossProfit)}`,
    ]
    if (report.returnsCount > 0) {
      lines.push('', `Returns: ${report.returnsCount} (Rs.${formatNumber(report.returnsRefundValue)})`)
    }
    const text = encodeURIComponent(lines.join('\n'))
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="btn h-9 px-4 inline-flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 no-print"
    >
      <MessageCircle className="h-4 w-4" />
      <span>Share</span>
    </button>
  )
}
