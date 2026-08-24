import { format } from 'date-fns'
import { formatNumber } from '@/lib/utils/money'

/**
 * The purchase list as plain WhatsApp text. Deliberately carries no prices:
 * this is an order the shop sends out, not a bill.
 */

export interface ShareTextLine {
  name: string
  quantity: number
  unit?: string | null
}

export interface ShareTextInput {
  shopName: string
  listName?: string | null
  supplierName?: string | null
  date: Date
  lines: ShareTextLine[]
}

export function buildListShareText({
  shopName,
  listName,
  supplierName,
  date,
  lines,
}: ShareTextInput): string {
  const header = [shopName, listName ? `Purchase List: ${listName}` : 'Purchase List']
  if (supplierName) header.push(`Supplier: ${supplierName}`)
  header.push(format(date, 'dd/MM/yyyy'))

  const items = lines.map(
    (line, i) => `${i + 1}. ${line.name} - ${formatNumber(line.quantity)}${line.unit ? ` ${line.unit}` : ''}`
  )

  return [...header, '', ...items, '', `Total items: ${lines.length}`].join('\n')
}
