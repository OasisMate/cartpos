export function roundToTwo(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
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

