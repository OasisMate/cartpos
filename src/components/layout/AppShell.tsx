'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
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
  Languages,
  Repeat,
  ShoppingBag,
  CreditCard,
  Factory,
  BarChart3,
  UserCircle,
  ChevronDown,
  History,
  Megaphone,
  CalendarClock,
  Wallet,
  TriangleAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { BrandSpinner } from '@/components/ui/BrandSpinner'
import Link from 'next/link'
import NotificationBell from '@/components/layout/NotificationBell'

// Submenu link component for store options (small text, no icons, hover-only)
function SubmenuLink({ 
  href, 
  label, 
  isActive, 
  sidebarOpen 
}: { 
  href: string
  label: string
  isActive: boolean
  sidebarOpen: boolean
}) {
  if (!sidebarOpen) {
    return null // Don't render submenu items when sidebar is collapsed
  }
  
  return (
    <Link
      href={href}
      className={cn(
        'transition-all duration-200 rounded-md',
        'text-xs text-gray-600 hover:text-gray-900',
        // Hidden by default, shown on parent group hover
        'opacity-0 max-h-0 overflow-hidden',
        'group-hover/submenu:opacity-100 group-hover/submenu:max-h-10 group-hover/submenu:py-1.5',
        'px-4',
        // Active item is always visible
        isActive && 'opacity-100 max-h-10 py-1.5 text-blue-700 font-medium bg-blue-50'
      )}
      title={label}
    >
      {label}
    </Link>
  )
}

interface NavLink {
  label: string
  href: string
  icon: React.ReactNode
  indent?: number
}

interface NavGroup {
  title?: string
  links: NavLink[]
  isSubmenu?: boolean
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, selectOrg, selectShop } = useAuth()
  const { t, language, setLanguage, isRTL } = useLanguage()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Switching shop/org sets a cookie server-side, then re-renders the server
  // components (dashboard etc.) for the new selection. We track both the fetch
  // and the refresh so a loader stays up until the new data is actually on screen.
  const switchBusy = switching || isPending

  async function changeShop(shopId: string) {
    if (!shopId || shopId === user?.currentShopId) return
    setSwitching(true)
    try {
      await selectShop(shopId)
    } finally {
      setSwitching(false)
    }
    startTransition(() => router.refresh())
  }

  async function changeOrg(orgId: string) {
    if (!orgId || orgId === user?.currentOrgId) return
    setSwitching(true)
    try {
      await selectOrg(orgId)
    } finally {
      setSwitching(false)
    }
    startTransition(() => router.refresh())
  }
  const [orgMeta, setOrgMeta] = useState<{ id: string; name: string } | null>(null)
  const [storeMeta, setStoreMeta] = useState<{ id: string; name: string } | null>(null)
  const [orgAdminStoreMeta, setOrgAdminStoreMeta] = useState<{ id: string; name: string } | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  // Close the user menu when clicking outside it. Detect "inside" via a DOM attribute
  // (not a ref): the sidebar renders the user section twice (desktop + mobile), so a
  // single shared ref points at only one copy and would misread clicks on the other as
  // "outside" - closing the menu the same tick the click opens it.
  useEffect(() => {
    if (!userMenuOpen) return
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      if (!target?.closest('[data-user-menu]')) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  // Close the user menu when the sidebar collapses (cursor leaves) so it can't linger.
  useEffect(() => {
    if (!open) setUserMenuOpen(false)
  }, [open])

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

  // Fetch store metadata for org admin when viewing a store
  useEffect(() => {
    async function fetchOrgAdminStoreMeta(storeId: string, orgId: string) {
      try {
        // Try org stores endpoint first (for org admin)
        const res = await fetch(`/api/org/stores/${storeId}`)
        if (res.ok) {
          const data = await res.json()
          setOrgAdminStoreMeta({ id: data.shop?.id || storeId, name: data.shop?.name || 'Store' })
          return
        }
        // Fallback: try admin endpoint
        const adminRes = await fetch(`/api/admin/shops/${storeId}`)
        if (adminRes.ok) {
          const data = await adminRes.json()
          setOrgAdminStoreMeta({ id: data.shop.id, name: data.shop.name })
          return
        }
        // Last resort: try to extract from user's shops if available
        if (user?.shops) {
          const userShop = user.shops.find((s: any) => s.shopId === storeId)
          if (userShop) {
            setOrgAdminStoreMeta({ id: userShop.shopId, name: userShop.shop.name })
            return
          }
        }
      } catch (error) {
        console.error('Failed to load store metadata for org admin', error)
      }
    }

    const storeIdFromPath = pathname?.match(/\/org\/[^\/]+\/stores\/([^\/]+)/)?.[1]
    const orgIdFromPath = pathname?.match(/\/org\/([^\/]+)/)?.[1]
    const isViewingStorePage = storeIdFromPath && pathname?.includes(`/stores/${storeIdFromPath}`)
    
    if (isViewingStorePage && storeIdFromPath && orgIdFromPath) {
      fetchOrgAdminStoreMeta(storeIdFromPath, orgIdFromPath)
    } else {
      setOrgAdminStoreMeta(null)
    }
  }, [pathname, user?.shops])

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
            label: t('dashboard'),
            href: '/cashier/dashboard',
            icon: <LayoutDashboard className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('pos'),
            href: '/pos',
            icon: <ShoppingCart className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
        ],
      })
      return groups
    }

    // PLATFORM ADMIN: Context-aware navigation
    if (user?.role === 'PLATFORM_ADMIN') {
      // Platform-level links stay at the top.
      const topLinks: NavLink[] = [
        {
          label: t('dashboard'),
          href: '/admin',
          icon: <LayoutDashboard className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
        {
          label: t('organizations'),
          href: '/admin/organizations',
          icon: <Building2 className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
        {
          label: t('stores'),
          href: '/admin/shops',
          icon: <Store className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
        {
          label: 'Broadcast',
          href: '/admin/broadcast',
          icon: <Megaphone className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
        {
          label: 'Sync reports',
          href: '/admin/sync-reports',
          icon: <TriangleAlert className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
      ]
      // Users + Settings go in a bottom group so they never split the store section.
      const bottomLinks: NavLink[] = [
        {
          label: t('users'),
          href: '/admin/users',
          icon: <Users className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
        {
          label: t('settings'),
          href: '/settings',
          icon: <Settings className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
      ]

      groups.push({ links: topLinks })
      
      // Org nav for Platform Admin when viewing an organization. Icon'd links under a
      // store-name heading (visible collapsed or expanded), consistent with the store nav.
      if (contextOrgId && !contextStoreId) {
        const orgName = orgMeta?.name || 'Organization'
        const ico = 'h-4 w-4 flex-shrink-0 text-gray-700'
        groups.push({
          title: orgName,
          links: [
            { label: t('dashboard'), href: `/org/${contextOrgId}`, icon: <LayoutDashboard className={ico} /> },
            { label: t('stores'), href: `/org/${contextOrgId}/stores`, icon: <Store className={ico} /> },
            { label: t('users'), href: `/org/${contextOrgId}/users`, icon: <Users className={ico} /> },
            { label: t('activity'), href: `/org/${contextOrgId}/activity`, icon: <History className={ico} /> },
          ],
        })
      }
      
      // Store nav for Platform Admin when viewing a store. Rendered as regular icon'd
      // links (not a collapse-hidden submenu) so the full store menu is always visible,
      // matching the store-manager experience.
      if (contextStoreId && contextOrgId && pathname?.includes(`/stores/${contextStoreId}`)) {
        const base = `/org/${contextOrgId}/stores/${contextStoreId}`
        const ico = 'h-4 w-4 flex-shrink-0 text-gray-700'
        groups.push({
          title: storeMeta?.name || 'Store',
          links: [
            { label: `${t('dashboard')}`, href: base, icon: <Store className={ico} /> },
            { label: t('pos'), href: `${base}/pos`, icon: <ShoppingCart className={ico} /> },
            { label: t('sales'), href: `${base}/sales`, icon: <TrendingUp className={ico} /> },
            { label: 'Quotations', href: `${base}/quotations`, icon: <FileText className={ico} /> },
            { label: t('customers'), href: `${base}/customers`, icon: <UserCircle className={ico} /> },
            { label: t('products'), href: `${base}/products`, icon: <Package className={ico} /> },
            { label: t('stock_adjustments'), href: `${base}/stock-adjustments`, icon: <Repeat className={ico} /> },
            { label: t('purchases'), href: `${base}/purchases`, icon: <ShoppingBag className={ico} /> },
            { label: t('suppliers'), href: `${base}/suppliers`, icon: <Factory className={ico} /> },
            { label: t('reports'), href: `${base}/reports`, icon: <BarChart3 className={ico} /> },
            { label: 'Cash Drawers', href: `${base}/drawers`, icon: <Wallet className={ico} /> },
          ],
        })
      }

      // Users + Settings at the bottom.
      groups.push({ links: bottomLinks })

      return groups
    }

    // ORG ADMIN: Organization-level navigation
    if (isOrgAdmin && user?.currentOrgId) {
      const orgLinks: NavLink[] = [
        {
          label: t('dashboard'),
          href: '/org',
          icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
        {
          label: t('stores'),
          href: '/org/shops',
          icon: <Store className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
        {
          label: t('users'),
          href: '/org/users',
          icon: <Users className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
        {
          label: t('activity'),
          href: '/org/activity',
          icon: <History className="h-4 w-4 flex-shrink-0 text-gray-700" />,
        },
        {
          label: t('settings'),
          href: '/settings',
          icon: <Settings className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
      ]

      // Check if org admin is actually viewing a store page (not just has access)
      const storeIdFromPath = pathname?.match(/\/org\/[^\/]+\/stores\/([^\/]+)/)?.[1]
      const viewingStore = !!storeIdFromPath && pathname?.includes(`/stores/${storeIdFromPath}`)
      const activeStoreId = storeIdFromPath

      groups.push({ links: orgLinks })

      // Only show store submenu when actually viewing a store page
      if (viewingStore && activeStoreId) {
        // Use store name from metadata if available
        const storeName = orgAdminStoreMeta?.name || 'Store'
        
        groups.push({
          title: `${storeName} Options`,
          isSubmenu: true,
          links: [
            {
              label: t('pos'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/pos`,
              icon: <></>, // No icon for submenu items
            },
            {
              label: t('products'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/products`,
              icon: <></>,
            },
            {
              label: t('stock_adjustments'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/stock-adjustments`,
              icon: <></>,
            },
            {
              label: t('sales'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/sales`,
              icon: <></>,
            },
            {
              label: t('purchases'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/purchases`,
              icon: <></>,
            },
            {
              label: t('customers'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/customers`,
              icon: <></>,
            },
            {
              label: t('suppliers'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/suppliers`,
              icon: <></>,
            },
            // Udhaar view is handled via customers/ledger, no separate menu item
            {
              label: t('reports'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/reports`,
              icon: <></>,
            },
          ],
        })
      }

      return groups
    }

    // STORE MANAGER: Store-level navigation
    if (isStoreManager && user?.currentShopId) {
      groups.push({
        links: [
          {
            label: t('dashboard'),
            href: '/store',
            icon: <LayoutDashboard className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          // Sales workflow cluster
          {
            label: t('pos'),
            href: '/store/pos',
            icon: <ShoppingCart className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('sales'),
            href: '/store/sales',
            icon: <TrendingUp className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          // Quotations only show when enabled for this shop (hardware/electric/wholesale preset).
          ...(user?.features?.quotations !== false
            ? [{
                label: 'Quotations',
                href: '/store/quotations',
                icon: <FileText className="h-4 w-4 flex-shrink-0 text-gray-700" />,
              }]
            : []),
          {
            label: t('customers'),
            href: '/store/customers',
            icon: <UserCircle className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          // Inventory cluster
          {
            label: t('products'),
            href: '/store/products',
            icon: <Package className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('stock_adjustments'),
            href: '/store/stock-adjustments',
            icon: <Repeat className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          // Expiry alerts only for shops that track batch/expiry (pharmacy).
          ...(user?.features?.batchExpiry === true
            ? [{
                label: 'Expiry alerts',
                href: '/store/expiry',
                icon: <CalendarClock className="h-4 w-4 flex-shrink-0 text-gray-700" />,
              }]
            : []),
          // Purchasing / supplier cluster
          {
            label: t('purchases'),
            href: '/store/purchases',
            icon: <ShoppingBag className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('suppliers'),
            href: '/store/suppliers',
            icon: <Factory className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          // Analysis & settings
          {
            label: t('reports'),
            href: '/store/reports',
            icon: <BarChart3 className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: 'Cash Drawers',
            href: '/store/drawers',
            icon: <Wallet className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('expenses'),
            href: '/store/expenses',
            icon: <Receipt className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('settings'),
            href: '/settings',
            icon: <Settings className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
        ],
      })

      return groups
    }

    // DEFAULT: Basic navigation
    groups.push({
      links: [
        {
          label: t('dashboard'),
          href: '/',
          icon: <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />,
        },
        {
          label: t('settings'),
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

    // For dashboard routes (incl. the store-drilldown root /org/{id}/stores/{id}),
    // match exactly so sub-pages like /pos don't keep Dashboard highlighted.
    const isStoreRoot = /^\/org\/[^/]+\/stores\/[^/]+$/.test(href)
    if (href === '/' || href === '/org' || href === '/store' || href === '/admin' || href === '/cashier/dashboard' || isStoreRoot) {
      return pathname === href
    }

    // Starts with + slash (prevents /admin from matching /admin-something)
    if (pathname.startsWith(href + '/')) return true

    return false
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-3 bg-gradient-to-b from-blue-50 to-white border-r border-blue-200">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar">
            {/* Logo */}
            <div className={cn('w-full', open ? 'flex justify-center' : '')}>
              <Logo showText={open} />
            </div>

            {/* Navigation Links */}
            <div className="mt-6 flex flex-col gap-4 pb-0">
              {navGroups.map((group, index) => {
                const isSubmenu = group.isSubmenu
                return (
                  <div 
                    key={group.title || `group-${index}`} 
                    className={cn(
                      "flex flex-col gap-2",
                      isSubmenu && "group/submenu relative"
                    )}
                  >
                    {group.title && open && (
                      <div className="px-3 text-xs font-semibold uppercase tracking-wide text-blue-500">
                        {group.title}
                      </div>
                    )}
                    {group.links.map((link) => {
                      // For submenu items, render differently
                      if (isSubmenu) {
                        return (
                          <SubmenuLink
                            key={link.href}
                            href={link.href}
                            label={link.label}
                            isActive={isActive(link.href)}
                            sidebarOpen={open}
                          />
                        )
                      }
                      return (
                        <SidebarLink
                          key={link.href}
                          link={link}
                          className={cn(
                            'rounded-lg transition-all duration-200',
                            'border-0 outline-0 ring-0 shadow-none before:hidden after:hidden',
                            isActive(link.href)
                              ? 'bg-orange-100 text-orange-700 font-medium [&_svg]:text-orange-600'
                              : 'text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                          )}
                        />
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* User Profile Section */}
          <div className="border-t border-blue-200 pt-3 relative" ref={userMenuRef} data-user-menu>
            {user && (
              <>
                {/* User row: avatar + name (toggles menu) with the notification bell inline */}
                <div className={cn('flex items-center', open ? 'gap-1' : 'flex-col gap-2')}>
                  <button
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className={cn(
                      'flex items-center py-1.5 rounded-md transition-colors text-sm hover:bg-blue-100',
                      open ? 'flex-1 min-w-0 gap-2 px-2 justify-between' : 'justify-center px-0'
                    )}
                    title={!open ? user.name : undefined}
                    aria-expanded={userMenuOpen}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={user.name}
                        imageUrl={user.profileImageUrl}
                        className="h-7 w-7 text-xs"
                      />
                      {open && (
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {user.name}
                        </div>
                      )}
                    </div>
                    {open && (
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 text-gray-500 transition-transform flex-shrink-0',
                          userMenuOpen && 'rotate-180'
                        )}
                      />
                    )}
                  </button>
                  <NotificationBell sidebarOpen={open} />
                </div>

                {userMenuOpen && (
                  <div
                    className={cn(
                      'absolute bottom-full mb-2 rounded-lg border border-blue-100 bg-white shadow-lg p-1.5 flex items-center gap-1 z-50',
                      open ? 'left-1 right-1' : 'left-1 w-44'
                    )}
                  >
                    <button
                      type="button"
                      title={language === 'en' ? 'Switch to Urdu' : 'Switch to English'}
                      onClick={() => {
                        setLanguage(language === 'en' ? 'ur' : 'en')
                        setUserMenuOpen(false)
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-gray-700 hover:bg-blue-50 transition-colors"
                    >
                      <Languages className="h-4 w-4" />
                      <span className="text-xs font-medium">{language === 'en' ? 'اردو' : 'EN'}</span>
                    </button>
                    <button
                      type="button"
                      title={t('logout')}
                      onClick={async () => {
                        setUserMenuOpen(false)
                        await logout()
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-xs font-medium">{t('logout')}</span>
                    </button>
                  </div>
                )}

                {/* Organization/Shop Selectors - hide for Platform Admin */}
                {open && user.role !== 'PLATFORM_ADMIN' && (
                  <div className="space-y-2 px-3 transition-opacity duration-200">
                    {user.organizations && user.organizations.length > 1 && (
                      <select
                        value={user.currentOrgId || ''}
                        onChange={(e) => changeOrg(e.target.value)}
                        disabled={switchBusy}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
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
                        onChange={(e) => changeShop(e.target.value)}
                        disabled={switchBusy}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
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

          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Page Content */}
        <main className="relative flex-1 overflow-y-auto bg-gray-50">
          {user?.isDemoOrg && (
            <div className="bg-amber-100 border-b border-amber-300 text-amber-900 text-sm px-6 py-2 text-center font-medium">
              Demo mode. Explore freely. Destructive actions (delete, void) are disabled.
            </div>
          )}
          <div className="p-6">{children}</div>

          {switchBusy && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-white px-6 py-5 shadow-lg">
                <BrandSpinner size={40} />
                <span className="text-sm font-medium text-gray-700">Switching store...</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
