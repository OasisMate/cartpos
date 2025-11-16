'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function Sidebar() {
  const pathname = usePathname()
  const { user } = useAuth()

  // Don't show sidebar on login page
  if (pathname === '/login') {
    return null
  }

  // Define all navigation items with roles that can access them
  const allNavigation = [
    { name: 'POS', href: '/pos', roles: ['ADMIN', 'OWNER', 'CASHIER'] },
    { name: 'Products', href: '/backoffice/products', roles: ['ADMIN', 'OWNER'] },
    { name: 'Purchases', href: '/backoffice/purchases', roles: ['ADMIN', 'OWNER'] },
    { name: 'Sales', href: '/backoffice/sales', roles: ['ADMIN', 'OWNER'] },
    { name: 'Customers', href: '/backoffice/customers', roles: ['ADMIN', 'OWNER'] },
    { name: 'Udhaar', href: '/backoffice/udhaar', roles: ['ADMIN', 'OWNER'] },
    { name: 'Reports', href: '/backoffice/reports', roles: ['ADMIN', 'OWNER'] },
    { name: 'Admin', href: '/admin', roles: ['ADMIN'] },
    { name: 'Shops', href: '/admin/shops', roles: ['ADMIN'] },
  ]

  // Filter navigation based on user role
  const navigation = allNavigation.filter((item) => {
    if (!user) return false

    // ADMIN can see everything
    if (user.role === 'ADMIN') return true

    // For NORMAL users, check shop roles
    if (user.role === 'NORMAL' && user.shops && user.shops.length > 0) {
      const userShopRoles = user.shops.map((s) => s.shopRole)
      const isOwner = userShopRoles.includes('OWNER')
      const isCashier = userShopRoles.includes('CASHIER')

      // Check if user has required role for this nav item
      if (item.roles.includes('OWNER') && isOwner) return true
      if (item.roles.includes('CASHIER') && isCashier) return true

      return false
    }

    return false
  })

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:pt-16">
      <div className="flex-1 flex flex-col min-h-0 bg-white border-r border-gray-200">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}

