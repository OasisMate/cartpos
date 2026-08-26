/**
 * Ranking for the "Suggested" panel on a purchase list.
 *
 * Pure on purpose: the shop's stock and sales come from Prisma in
 * domain/purchaseLists.ts, and the decision of what to show and in what order
 * lives here where it can be tested without a database.
 */

export type SuggestionReason = 'LOW_STOCK' | 'SOLD_RECENTLY'

export interface LowStockCandidate {
  productId: string
  onHand: number
  reorderLevel: number
}

export interface SoldCandidate {
  productId: string
  baseUnitsSold: number
}

export interface RankSuggestionsInput {
  lowStock: LowStockCandidate[]
  sold: SoldCandidate[]
  excludeProductIds?: string[]
  limit?: number
}

export interface RankedSuggestion {
  productId: string
  reason: SuggestionReason
  /** LOW_STOCK only: how far under the reorder level it is. */
  shortfall?: number
  /** SOLD_RECENTLY only: base units sold in the window. */
  baseUnitsSold?: number
}

const DEFAULT_LIMIT = 50

export function rankSuggestions({
  lowStock,
  sold,
  excludeProductIds = [],
  limit = DEFAULT_LIMIT,
}: RankSuggestionsInput): RankedSuggestion[] {
  const excluded = new Set(excludeProductIds)
  const alreadyPicked = new Set<string>()
  const ranked: RankedSuggestion[] = []

  // A product with no reorder level set is not "low", it is untracked.
  const low = lowStock
    .filter((c) => !excluded.has(c.productId) && c.reorderLevel > 0 && c.onHand <= c.reorderLevel)
    .map((c) => ({ productId: c.productId, shortfall: c.reorderLevel - c.onHand }))
    .sort((a, b) => b.shortfall - a.shortfall || a.productId.localeCompare(b.productId))

  for (const candidate of low) {
    if (ranked.length >= limit) return ranked
    alreadyPicked.add(candidate.productId)
    ranked.push({ productId: candidate.productId, reason: 'LOW_STOCK', shortfall: candidate.shortfall })
  }

  const sellers = sold
    .filter((c) => !excluded.has(c.productId) && !alreadyPicked.has(c.productId) && c.baseUnitsSold > 0)
    .sort((a, b) => b.baseUnitsSold - a.baseUnitsSold || a.productId.localeCompare(b.productId))

  for (const candidate of sellers) {
    if (ranked.length >= limit) return ranked
    ranked.push({
      productId: candidate.productId,
      reason: 'SOLD_RECENTLY',
      baseUnitsSold: candidate.baseUnitsSold,
    })
  }

  return ranked
}
