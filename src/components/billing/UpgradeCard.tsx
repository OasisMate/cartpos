'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

/**
 * What a locked capability looks like.
 *
 * Deliberately NOT a greyed-out copy of the real thing. Identical products are
 * rated significantly more unfair when they look like a working version with
 * the good parts switched off, and the resentment peaks exactly when the two
 * tiers look alike (Gershoff, Kivetz & Keinan, JCR 2012). So this reads as a
 * menu item they have not bought, not as a broken widget.
 */
export function UpgradeCard({
  title,
  description,
  tier,
  canUpgrade = true,
  compact = false,
}: {
  title: string
  description: string
  tier: 'Team' | 'Business'
  /** False for staff, who cannot buy anything and should not be nagged. */
  canUpgrade?: boolean
  compact?: boolean
}) {
  return (
    <div
      className={`rounded-lg border border-dashed border-gray-300 bg-gray-50 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-0.5 text-xs text-gray-600">{description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white">
          {tier}
        </span>
      </div>
      {canUpgrade && (
        <Link
          href="/billing"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
        >
          See {tier} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}
