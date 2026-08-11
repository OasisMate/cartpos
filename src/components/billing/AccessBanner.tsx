'use client'

import Link from 'next/link'
import { AlertTriangle, Clock, Lock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

/**
 * One banner for every reason the app is not fully writable right now.
 *
 * Deliberately never blocks the screen. The shop can still read its history,
 * run reports and export, because holding a business's own records hostage is
 * both wrong and a support nightmare. What it does is say plainly what is
 * happening and what fixes it.
 *
 * Priority: shop frozen (most specific) > expired > expiring soon.
 */
export function AccessBanner() {
  const { user } = useAuth()
  if (!user) return null

  const billing = user.billing
  const currentShop = user.shops?.find((s) => s.shopId === user.currentShopId)?.shop
  const isOrgAdmin = user.organizations?.some((o) => o.orgRole === 'ORG_ADMIN')

  // 1. This shop is frozen.
  if (currentShop?.isActive === false) {
    const byOwner = currentShop.pausedReason !== 'PLAN_DOWNGRADE'
    return (
      <Banner
        tone="amber"
        icon={<Lock className="h-4 w-4" />}
        title={byOwner ? `${currentShop.name} is closed` : `${currentShop.name} is paused`}
        message={
          byOwner
            ? 'You can view past records, but nothing new can be recorded until the owner reopens this shop.'
            : 'Your plan does not cover this shop. You can view past records, but nothing new can be recorded.'
        }
        action={!byOwner && isOrgAdmin ? { href: '/billing', label: 'View plans' } : undefined}
      />
    )
  }

  if (!billing || !billing.enforced || billing.bypass) return null

  // 2. Subscription has run out.
  //
  // The instruction has to match who is reading it. Staff cannot buy anything,
  // so telling a cashier to "choose a plan" sends them hunting for a screen they
  // will never find, and they conclude the app is broken. Note this does NOT use
  // billing.blockedReason: that string is written for the owner, and repeating
  // it after the title duplicated the sentence.
  if (!billing.canWrite) {
    return (
      <Banner
        tone="red"
        icon={<Lock className="h-4 w-4" />}
        title={billing.inTrial ? 'Your free trial has ended' : 'Your subscription has expired'}
        message={
          isOrgAdmin
            ? `${billing.inTrial ? 'Choose a plan' : 'Send your payment'} to start selling again. Your sales, stock and customer records are all safe and come straight back.`
            : 'You can still look up past sales and customers, but new sales cannot be recorded. Please ask the shop owner to renew.'
        }
        action={isOrgAdmin ? { href: '/billing', label: billing.inTrial ? 'Choose a plan' : 'Pay now' } : undefined}
      />
    )
  }

  // 3. Running out. Warn from 5 days, and through the grace window.
  const days = billing.daysLeft
  if (days === null || days > 5) return null

  const overdue = days < 0
  return (
    <Banner
      tone={overdue || days <= 2 ? 'amber' : 'blue'}
      icon={overdue ? <AlertTriangle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
      title={
        overdue
          ? billing.inTrial
            ? 'Your trial has ended'
            : 'Your payment is overdue'
          : billing.inTrial
            ? `Your free trial ends in ${days} ${days === 1 ? 'day' : 'days'}`
            : `Your plan renews in ${days} ${days === 1 ? 'day' : 'days'}`
      }
      message={
        !isOrgAdmin
          ? overdue
            ? 'You can keep selling for a few more days. Please let the shop owner know.'
            : 'Nothing changes for you yet. Please let the shop owner know.'
          : overdue
            ? 'You can keep selling for a few more days. After that the account becomes read-only until payment is received.'
            : billing.inTrial
              ? 'Pick a plan to keep selling without interruption.'
              : 'Send your payment to avoid any interruption.'
      }
      action={isOrgAdmin ? { href: '/billing', label: overdue ? 'Pay now' : 'View plans' } : undefined}
    />
  )
}

const TONES = {
  red: 'border-red-200 bg-red-50 text-red-900',
  amber: 'border-amber-200 bg-amber-50 text-amber-900',
  blue: 'border-blue-200 bg-blue-50 text-blue-900',
} as const

const BUTTONS = {
  red: 'bg-red-600 hover:bg-red-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
  blue: 'bg-blue-600 hover:bg-blue-700',
} as const

function Banner({
  tone,
  icon,
  title,
  message,
  action,
}: {
  tone: keyof typeof TONES
  icon: React.ReactNode
  title: string
  message: string
  action?: { href: string; label: string }
}) {
  return (
    <div className={`flex flex-wrap items-start gap-3 border-b px-4 py-2.5 text-sm ${TONES[tone]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{title}.</span> <span className="opacity-90">{message}</span>
      </div>
      {action && (
        <Link
          href={action.href}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors ${BUTTONS[tone]}`}
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
