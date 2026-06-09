/**
 * Reusable loading skeleton primitives. Use instead of plain "Loading…" text
 * so screens reserve layout and feel responsive while data loads (remote DB
 * latency makes this very visible).
 */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 ${className}`} aria-hidden="true" />
}

/** A card-shaped stat skeleton (matches the dashboard/report metric cards). */
export function SkeletonCard() {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-7 w-32" />
    </div>
  )
}

/** A grid of stat-card skeletons. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
