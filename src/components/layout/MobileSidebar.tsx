'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const { user } = useAuth()

  if (!open) return null

  const posNav = [{ name: 'POS', href: '/pos', roles: ['ADMIN', 'OWNER', 'CASHIER'] }]
  const backofficeNav = [
    { name: 'Dashboard', href: '/backoffice', roles: ['ADMIN', 'OWNER'] },
    { name: 'Products', href: '/backoffice/products', roles: ['ADMIN', 'OWNER'] },
    { name: 'Purchases', href: '/backoffice/purchases', roles: ['ADMIN', 'OWNER'] },
    { name: 'Sales', href: '/backoffice/sales', roles: ['ADMIN', 'OWNER'] },
    { name: 'Customers', href: '/backoffice/customers', roles: ['ADMIN', 'OWNER'] },
    { name: 'Udhaar', href: '/backoffice/udhaar', roles: ['ADMIN', 'OWNER'] },
    { name: 'Reports', href: '/backoffice/reports', roles: ['ADMIN', 'OWNER'] },
  ]
  const adminNav = [
    { name: 'Admin', href: '/admin', roles: ['ADMIN'] },
    { name: 'Shops', href: '/admin/shops', roles: ['ADMIN'] },
  ]

  const canSee = (item: { roles: string[] }) => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    if (user.role === 'NORMAL' && user.shops && user.shops.length > 0) {
      const userShopRoles = user.shops.map((s) => s.shopRole)
      const isOwner = userShopRoles.includes('OWNER')
      const isCashier = userShopRoles.includes('CASHIER')
      if (item.roles.includes('OWNER') && isOwner) return true
      if (item.roles.includes('CASHIER') && isCashier) return true
      return false
    }
    return false
  }

  const posItems = posNav.filter(canSee)
  const backofficeItems = backofficeNav.filter(canSee)
  const adminItems = adminNav.filter(canSee)

  function NavGroup({
    title,
    items,
  }: {
    title: string
    items: Array<{ name: string; href: string }>
  }) {
    if (!items.length) return null
    return (
      <div className="mb-4">
        <div className="px-4 pb-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          {title}
        </div>
        <div className="space-y-1">
          {items.map((item) => {
            const isActive = pathname?.startsWith(item.href)
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`block mx-2 ${
                  isActive
                    ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                } px-3 py-2 text-sm rounded-md`}
              >
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] w-72 h-full shadow-lg">
        <div className="pt-16" />
        <div className="py-4 overflow-y-auto">
          <NavGroup title="POS" items={posItems} />
          <NavGroup title="Backoffice" items={backofficeItems} />
          <NavGroup title="Admin" items={adminItems} />
        </div>
      </div>
    </div>
  )
}


