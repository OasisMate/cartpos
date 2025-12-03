export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Formats a number intelligently - shows decimals only when needed
 * Examples: 100 -> "100", 100.5 -> "100.5", 100.50 -> "100.5", 100.00 -> "100"
 */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0'
  
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  
  // Round to 2 decimal places to avoid floating point issues
  const rounded = roundToTwo(num)
  
  // If it's a whole number, return without decimals
  if (Math.abs(rounded % 1) < Number.EPSILON) {
    return Math.round(rounded).toString()
  }
  
  // Otherwise, format to 2 decimal places and remove trailing zeros
  const formatted = rounded.toFixed(2)
  return formatted.replace(/\.?0+$/, '')
}

/**
 * Formats a number for currency display - shows decimals only when needed
 * Same as formatNumber but with currency prefix
 */
export function formatCurrency(value: number | string | null | undefined, prefix: string = 'Rs.'): string {
  return `${prefix}${formatNumber(value)}`
}

export function calculateTotals(subtotal: number, discount: number) {
  const roundedSubtotal = roundToTwo(subtotal)
  const roundedDiscount = roundToTwo(discount || 0)
  const total = roundToTwo(roundedSubtotal - roundedDiscount)
  return { subtotal: roundedSubtotal, discount: roundedDiscount, total }
}

export function sumCartLines<T extends { lineTotal: number }>(items: T[]): number {
  return roundToTwo(items.reduce((sum, item) => sum + item.lineTotal, 0))
}

