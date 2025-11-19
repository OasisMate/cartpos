'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  Building2,
  Users,
  Store,
  Settings,
  LogOut,
  ShoppingCart,
  Package,
  TrendingUp,
  Receipt,
  Truck,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'

interface NavLink {
  label: string
  href: string
  icon: React.ReactNode
  indent?: number
}

interface NavGroup {
  title?: string
  links: NavLink[]
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout, selectOrg, selectShop } = useAuth()
  const [open, setOpen] = useState(false)
  const [orgMeta, setOrgMeta] = useState<{ id: string; name: string } | null>(null)
  const [storeMeta, setStoreMeta] = useState<{ id: string; name: string } | null>(null)

  // Extract context from URL if Platform Admin viewing org/store
  const orgIdMatch = pathname?.match(/\/org\/([^\/]+)/)
  // Match store ID in pattern: /org/[orgId]/stores/[storeId]
  const storeIdMatch = pathname?.match(/\/org\/[^\/]+\/stores\/([^\/]+)/)
  const contextOrgId = orgIdMatch ? orgIdMatch[1] : null
  const contextStoreId = storeIdMatch ? storeIdMatch[1] : null

  // Navigation links - show based on user role and context
  useEffect(() => {
    async function fetchOrgMeta(orgId: string) {
      try {
        const res = await fetch(`/api/admin/organizations/${orgId}`)
        if (!res.ok) return
        const data = await res.json()
        setOrgMeta({ id: data.organization.id, name: data.organization.name })
      } catch (error) {
        console.error('Failed to load org metadata', error)
      }
    }

    if (user?.role === 'PLATFORM_ADMIN' && contextOrgId) {
      fetchOrgMeta(contextOrgId)
    } else {
      setOrgMeta(null)
    }
  }, [contextOrgId, user?.role])

  useEffect(() => {
    async function fetchStoreMeta(storeId: string) {
      try {
        const res = await fetch(`/api/admin/shops/${storeId}`)
        if (!res.ok) return
        const data = await res.json()
        setStoreMeta({ id: data.shop.id, name: data.shop.name })
      } catch (error) {
        console.error('Failed to load store metadata', error)
      }
    }

    if (user?.role === 'PLATFORM_ADMIN' && contextStoreId) {
      fetchStoreMeta(contextStoreId)
    } else if (!contextStoreId) {
      setStoreMeta(null)
    }
  }, [contextStoreId, user?.role])

  const getNavGroups = (): NavGroup[] => {
    const groups: NavGroup[] = []

    const isOrgAdmin = user?.organizations?.some(
      (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
    )

    const isStoreManager = user?.shops?.some(
      (s: any) => s.shopId === user.currentShopId && s.shopRole === 'STORE_MANAGER'
    )

    const isCashier = user?.shops?.some(
      (s: any) => s.shopId === user.currentShopId && s.shopRole === 'CASHIER'
    )

    // CASHIER: Limited navigation
    if (isCashier && user?.role !== 'PLATFORM_ADMIN' && !isOrgAdmin && !isStoreManager) {
      groups.push({
        links: [
          {
        label: 'My Dashboard',
        href: '/cashier/dashboard',
        icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
        label: 'POS',
        href: '/pos',
        icon: <ShoppingCart className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
        ],
      })
      return groups
    }

    // PLATFORM ADMIN: Context-aware navigation
    if (user?.role === 'PLATFORM_ADMIN') {
      const adminLinks: NavLink[] = [
        {
          label: 'Dashboard',
          href: '/admin',
          icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
        {
          label: 'Organizations',
          href: '/admin/organizations',
          icon: <Building2 className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
        {
          label: 'Users',
          href: '/admin/users',
          icon: <Users className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
        {
          label: 'Settings',
          href: '/settings',
          icon: <Settings className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
      ]

      if (contextOrgId) {
        const orgName = orgMeta?.name || 'Organization'
        const orgChildren: NavLink[] = [
          {
            label: `${orgName} · Org Dashboard`,
            href: `/org/${contextOrgId}`,
            icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />,
            indent: 1,
          },
          {
            label: `${orgName} · Stores`,
            href: `/org/${contextOrgId}/stores`,
            icon: <Store className="h-5 w-5 flex-shrink-0 text-gray-700" />,
            indent: 1,
          },
          {
            label: `${orgName} · Users`,
            href: `/org/${contextOrgId}/users`,
            icon: <Users className="h-5 w-5 flex-shrink-0 text-gray-700" />,
            indent: 1,
          },
        ]

        const orgIndex = adminLinks.findIndex((link) => link.href === '/admin/organizations')
        adminLinks.splice(orgIndex + 1, 0, ...orgChildren)

        if (contextStoreId) {
          const storeName = storeMeta?.name || 'Store'
          const storeChildren: NavLink[] = [
            {
              label: `${storeName} · Store Dashboard`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}`,
              icon: <Store className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
            {
              label: `${storeName} · POS`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}/pos`,
              icon: <ShoppingCart className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
            {
              label: `${storeName} · Products`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}/products`,
              icon: <Package className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
            {
              label: `${storeName} · Sales`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}/sales`,
              icon: <TrendingUp className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
            {
              label: `${storeName} · Purchases`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}/purchases`,
              icon: <Truck className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
            {
              label: `${storeName} · Customers`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}/customers`,
              icon: <Users className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
            {
              label: `${storeName} · Suppliers`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}/suppliers`,
              icon: <Truck className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
            {
              label: `${storeName} · Udhaar`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}/udhaar`,
              icon: <Receipt className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
            {
              label: `${storeName} · Reports`,
              href: `/org/${contextOrgId}/stores/${contextStoreId}/reports`,
              icon: <FileText className="h-5 w-5 flex-shrink-0 text-gray-700" />,
              indent: 2,
            },
          ]

          const insertIndex = orgIndex + 1 + orgChildren.length
          adminLinks.splice(insertIndex, 0, ...storeChildren)
        }
      }

      groups.push({ links: adminLinks })
      return groups
    }

    // ORG ADMIN: Organization-level navigation
    if (isOrgAdmin && user?.currentOrgId) {
      groups.push({
        links: [
          {
            label: 'Dashboard',
            href: '/org',
            icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Stores',
            href: '/org/shops',
            icon: <Store className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Users',
            href: '/org/users',
            icon: <Users className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Settings',
            href: '/settings',
            icon: <Settings className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
        ],
      })

      return groups
    }

    // STORE MANAGER: Store-level navigation
    if (isStoreManager && user?.currentShopId) {
      groups.push({
        links: [
          {
            label: 'Dashboard',
            href: '/store',
            icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'POS',
            href: '/store/pos',
            icon: <ShoppingCart className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Products',
            href: '/store/products',
            icon: <Package className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Sales',
            href: '/store/sales',
            icon: <TrendingUp className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Purchases',
            href: '/store/purchases',
            icon: <Truck className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Customers',
            href: '/store/customers',
            icon: <Users className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Suppliers',
            href: '/store/suppliers',
            icon: <Truck className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Udhaar',
            href: '/store/udhaar',
            icon: <Receipt className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Reports',
            href: '/store/reports',
            icon: <FileText className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Settings',
            href: '/settings',
            icon: <Settings className="h-5 w-5 flex-shrink-0 text-gray-700" />,
          },
        ],
      })

      return groups
    }

    // DEFAULT: Basic navigation
    groups.push({
      links: [
        {
          label: 'Dashboard',
          href: '/',
          icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
        {
          label: 'Settings',
          href: '/settings',
          icon: <Settings className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
      ],
    })

    return groups
  }

  const navGroups = getNavGroups()

  // Check if a link is active
  const isActive = (href: string) => {
    if (!pathname) return false

    // Exact match
    if (pathname === href) return true

    // For dashboard routes
    if (href === '/' || href === '/org' || href === '/store' || href === '/admin' || href === '/cashier/dashboard') {
      return pathname === href
    }

    // Starts with + slash (prevents /admin from matching /admin-something)
    if (pathname.startsWith(href + '/')) return true

    return false
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 bg-gradient-to-b from-blue-50 to-white border-r border-blue-200">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {/* Logo */}
            <Logo showText={open} />

            {/* Navigation Links */}
            <div className="mt-8 flex flex-col gap-5">
              {navGroups.map((group, index) => (
                <div key={group.title || `group-${index}`} className="flex flex-col gap-2">
                  {group.title && open && (
                    <div className="px-3 text-xs font-semibold uppercase tracking-wide text-blue-500">
                      {group.title}
                    </div>
                  )}
                  {group.links.map((link) => (
                    <SidebarLink
                      key={link.href}
                      link={link}
                      className={cn(
                        'rounded-lg transition-all duration-200',
                        'border-0 outline-0 ring-0 shadow-none before:hidden after:hidden',
                        isActive(link.href)
                          ? 'bg-orange-500 text-white [&_svg]:text-white'
                          : 'text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* User Profile Section */}
          <div className="border-t border-blue-200 pt-4 space-y-2">
            {user && (
              <>
                <div
                  className={cn(
                    'flex items-center py-2 rounded-lg hover:bg-blue-100 transition-colors',
                    open ? 'gap-3 px-3' : 'justify-center px-0'
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">
                      {user.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                  {open && (
                    <div className="flex-1 min-w-0 transition-opacity duration-200">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {user.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                  )}
                </div>

                {/* Organization/Shop Selectors - hide for Platform Admin */}
                {open && user.role !== 'PLATFORM_ADMIN' && (
                  <div className="space-y-2 px-3 transition-opacity duration-200">
                    {user.organizations && user.organizations.length > 1 && (
                      <select
                        value={user.currentOrgId || ''}
                        onChange={(e) => selectOrg(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {user.organizations.map((o) => (
                          <option key={o.orgId} value={o.orgId}>
                            {o.organization.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {user.shops && user.shops.length > 1 && (
                      <select
                        value={user.currentShopId || ''}
                        onChange={(e) => selectShop(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {user.shops.map((s) => (
                          <option key={s.shopId} value={s.shopId}>
                            {s.shop.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </>
            )}
            <button
              onClick={logout}
              className={cn(
                'w-full mt-2 flex items-center py-2 rounded-lg transition-all duration-200',
                'text-red-600 hover:bg-red-50',
                open ? 'gap-2 px-3 justify-start' : 'justify-center px-0'
              )}
              title={!open ? 'Logout' : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {open && <span className="text-sm font-medium transition-opacity duration-200">Logout</span>}
            </button>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
