'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'
import Link from 'next/link'

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
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout, selectOrg, selectShop } = useAuth()
  const { t, language, setLanguage, isRTL } = useLanguage()
  const [open, setOpen] = useState(false)
  const [orgMeta, setOrgMeta] = useState<{ id: string; name: string } | null>(null)
  const [storeMeta, setStoreMeta] = useState<{ id: string; name: string } | null>(null)
  const [orgAdminStoreMeta, setOrgAdminStoreMeta] = useState<{ id: string; name: string } | null>(null)

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
      const adminLinks: NavLink[] = [
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

      if (contextOrgId) {
        const orgName = orgMeta?.name || 'Organization'
        const orgChildren: NavLink[] = [
          {
            label: `${orgName} · Org Dashboard`,
            href: `/org/${contextOrgId}`,
            icon: <LayoutDashboard className="h-4 w-4 flex-shrink-0 text-gray-700" />,
            indent: 1,
          },
          {
            label: `${orgName} · ${t('stores')}`,
            href: `/org/${contextOrgId}/stores`,
            icon: <Store className="h-4 w-4 flex-shrink-0 text-gray-700" />,
            indent: 1,
          },
          {
            label: `${orgName} · ${t('users')}`,
            href: `/org/${contextOrgId}/users`,
            icon: <Users className="h-4 w-4 flex-shrink-0 text-gray-700" />,
            indent: 1,
          },
        ]

        const orgIndex = adminLinks.findIndex((link) => link.href === '/admin/organizations')
        adminLinks.splice(orgIndex + 1, 0, ...orgChildren)

        if (contextStoreId) {
          // Store dashboard link stays in main nav
          const storeDashboardLink: NavLink = {
            label: `${storeMeta?.name || 'Store'} · Dashboard`,
            href: `/org/${contextOrgId}/stores/${contextStoreId}`,
            icon: <Store className="h-4 w-4 flex-shrink-0 text-gray-700" />,
            indent: 2,
          }
          
          const insertIndex = orgIndex + 1 + orgChildren.length
          adminLinks.splice(insertIndex, 0, storeDashboardLink)
          
          // Store submenu options will be added as a separate group
        }
      }

      groups.push({ links: adminLinks })
      
      // Add org submenu for Platform Admin when viewing an organization (but not a store)
      if (contextOrgId && !contextStoreId) {
        const orgName = orgMeta?.name || 'Organization'
        groups.push({
          title: `${orgName} Options`,
          links: [
            {
              label: t('dashboard'),
              href: `/org/${contextOrgId}`,
              icon: <></>,
            },
            {
              label: t('stores'),
              href: `/org/${contextOrgId}/stores`,
              icon: <></>,
            },
            {
              label: t('users'),
              href: `/org/${contextOrgId}/users`,
              icon: <></>,
            },
          ],
        })
      }
      
      // Add store submenu for Platform Admin only when actually viewing a store page
      if (contextStoreId && contextOrgId && pathname?.includes(`/stores/${contextStoreId}`)) {
        const storeName = storeMeta?.name || 'Store'
        groups.push({
          title: `${storeName} Options`,
          links: [
            {
              label: t('pos'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/pos`,
              icon: <></>,
            },
            {
              label: t('products'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/products`,
              icon: <></>,
            },
            {
              label: t('stock_adjustments'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/stock-adjustments`,
              icon: <></>,
            },
            {
              label: t('sales'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/sales`,
              icon: <></>,
            },
            {
              label: t('purchases'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/purchases`,
              icon: <></>,
            },
            {
              label: t('customers'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/customers`,
              icon: <></>,
            },
            {
              label: t('suppliers'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/suppliers`,
              icon: <></>,
            },
            {
              label: t('udhaar'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/customers?balance=true`,
              icon: <></>,
            },
            {
              label: t('reports'),
              href: `/org/${contextOrgId}/stores/${contextStoreId}/reports`,
              icon: <></>,
            },
          ],
        })
      }
      
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
            {
              label: t('udhaar'),
              href: `/org/${user.currentOrgId}/stores/${activeStoreId}/customers?balance=true`,
              icon: <></>,
            },
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
          {
            label: t('pos'),
            href: '/store/pos',
            icon: <ShoppingCart className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('products'),
            href: '/store/products',
            icon: <Package className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('stock_adjustments'),
            href: '/store/stock-adjustments',
            icon: <Package className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('sales'),
            href: '/store/sales',
            icon: <TrendingUp className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('purchases'),
            href: '/store/purchases',
            icon: <Truck className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('customers'),
            href: '/store/customers',
            icon: <Users className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
            {
              label: t('suppliers'),
              href: '/store/suppliers',
              icon: <Truck className="h-4 w-4 flex-shrink-0 text-gray-700" />,
            },
          {
            label: t('udhaar'),
            href: '/backoffice/customers?balance=true',
            icon: <Receipt className="h-4 w-4 flex-shrink-0 text-gray-700" />,
          },
          {
            label: t('reports'),
            href: '/store/reports',
            icon: <FileText className="h-4 w-4 flex-shrink-0 text-gray-700" />,
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
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar">
            {/* Logo */}
            <Logo showText={open} />

            {/* Navigation Links */}
            <div className="mt-8 flex flex-col gap-5">
              {navGroups.map((group, index) => {
                const isSubmenu = group.title === 'Store Options'
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
                              ? 'bg-orange-500 text-white [&_svg]:text-white'
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

            {/* Language Toggle - Compact version next to user info */}
            {open && (
              <div className="px-3 pb-2">
                <button
                  onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
                  className={cn(
                    'w-full flex items-center justify-center py-1.5 rounded-md transition-all duration-200',
                    'text-xs text-gray-600 hover:bg-blue-100 hover:text-blue-700',
                    'border border-gray-200'
                  )}
                  title={language === 'en' ? 'Switch to Urdu' : 'Switch to English'}
                >
                  <Languages className="h-3.5 w-3.5 mr-1.5" />
                  <span>{language === 'en' ? 'اردو' : 'English'}</span>
                </button>
              </div>
            )}
            {!open && (
              <button
                onClick={() => setLanguage(language === 'en' ? 'ur' : 'en')}
                className={cn(
                  'w-full flex items-center justify-center py-2 rounded-lg transition-all duration-200',
                  'text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                )}
                title={language === 'en' ? 'Switch to Urdu' : 'Switch to English'}
              >
                <Languages className="h-4 w-4 flex-shrink-0" />
              </button>
            )}

            <button
              onClick={logout}
              className={cn(
                'w-full mt-2 flex items-center py-2 rounded-lg transition-all duration-200',
                'text-red-600 hover:bg-red-50',
                open ? 'gap-2 px-3 justify-start' : 'justify-center px-0'
              )}
              title={!open ? t('logout') : undefined}
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
              {open && <span className="text-sm font-medium transition-opacity duration-200">{t('logout')}</span>}
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
