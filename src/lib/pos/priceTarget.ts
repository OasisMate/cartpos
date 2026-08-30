/**
 * Which product field a cart line's price came from.
 *
 * The POS prices a line from one of four places (see addToCart in src/app/pos/page.tsx):
 * a packaging level's own price, the carton price, the trade rate, or plain retail. When an
 * admin edits the price and asks to save it on the product, it has to go back to the same
 * field it came from, so this resolver is the single place that decides which.
 */

export type PriceField = 'price' | 'tradePrice' | 'cartonPrice' | 'packLevel'

/** The part of a cart line that decides where its price lives. */
export interface PriceTargetLine {
  isCarton?: boolean
  packName?: string
  /** The rate this line was sold at, recorded when it was added to the cart. */
  priceField?: PriceField
}

export interface PriceTarget {
  field: PriceField
  /** Only set for 'packLevel': which packaging level of the product to write. */
  packName?: string
  /** Names the rate in the UI, e.g. "Also update saved retail price". */
  label: string
}

export function resolvePriceTarget(
  line: PriceTargetLine,
  priceMode: 'RETAIL' | 'TRADE'
): PriceTarget {
  if (line.packName) {
    return { field: 'packLevel', packName: line.packName, label: line.packName }
  }
  if (line.isCarton) {
    return { field: 'cartonPrice', label: 'carton' }
  }
  // Retail vs trade is the only ambiguous case: the cashier can toggle the price mode
  // mid-sale, so the rate recorded on the line wins over whatever mode is active now.
  const field = line.priceField ?? (priceMode === 'TRADE' ? 'tradePrice' : 'price')
  return field === 'tradePrice'
    ? { field: 'tradePrice', label: 'trade' }
    : { field: 'price', label: 'retail' }
}

/** Just enough of a product to read its sale rates. */
export interface SavedPriceProduct {
  price: number
  tradePrice?: number | null
  cartonPrice?: number | null
  packagingLevels?: Array<{ name: string; price: number | null }>
}

/**
 * The rate currently stored on the product for this target, or null when none is stored
 * (no trade rate set, a carton price still derived from price x cartonSize, a packaging
 * level with no price of its own). Null means "nothing to compare against" - saving would
 * establish the rate rather than change it.
 */
export function savedPriceFor(product: SavedPriceProduct, target: PriceTarget): number | null {
  if (target.field === 'packLevel') {
    const level = product.packagingLevels?.find((l) => l.name === target.packName)
    return level?.price ?? null
  }
  if (target.field === 'cartonPrice') return product.cartonPrice ?? null
  if (target.field === 'tradePrice') return product.tradePrice ?? null
  return product.price ?? null
}
