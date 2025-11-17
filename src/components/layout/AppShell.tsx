'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout, selectOrg, selectShop } = useAuth()
  const [open, setOpen] = useState(false)

  // Navigation links - show based on user role
  const getNavLinks = () => {
    const links = []

    // Determine if user is Org Admin
    const isOrgAdmin = user?.organizations?.some(
      (o: any) => o.orgId === user.currentOrgId && o.orgRole === 'ORG_ADMIN'
    )

    // Dashboard - point to org dashboard if Org Admin, otherwise home
    const dashboardHref = isOrgAdmin && user?.currentOrgId ? '/org' : '/'
    links.push({
      label: 'Dashboard',
      href: dashboardHref,
      icon: (
        <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-gray-700" />
      ),
    })

    // Platform Admin-only links
    if (user?.role === 'PLATFORM_ADMIN') {
      links.push({
        label: 'Organizations',
        href: '/admin/organizations',
        icon: (
          <Building2 className="h-5 w-5 flex-shrink-0 text-gray-700" />
        ),
      })
      links.push({
        label: 'Users',
        href: '/admin/users',
        icon: (
          <Users className="h-5 w-5 flex-shrink-0 text-gray-700" />
        ),
      })
      links.push({
        label: 'Shops',
        href: '/admin/shops',
        icon: (
          <Store className="h-5 w-5 flex-shrink-0 text-gray-700" />
        ),
      })
    }

    // Org Admin links - show when user is Org Admin and has currentOrgId
    if (isOrgAdmin && user?.currentOrgId) {
      links.push({
        label: 'Stores',
        href: '/org/shops',
        icon: (
          <Store className="h-5 w-5 flex-shrink-0 text-gray-700" />
        ),
      })
      links.push({
        label: 'Users',
        href: '/org/users',
        icon: (
          <Users className="h-5 w-5 flex-shrink-0 text-gray-700" />
        ),
      })
    }

    // Settings - available to all authenticated users
    links.push({
      label: 'Settings',
      href: '/settings',
      icon: (
        <Settings className="h-5 w-5 flex-shrink-0 text-gray-700" />
      ),
    })

    return links
  }

  const navLinks = getNavLinks()

  // Check if a link is active
  const isActive = (href: string) => {
    if (!pathname) return false
    
    if (href === '/' || href === '/org') {
      // Dashboard is active on exact home, admin dashboard, or org dashboard
      return pathname === '/' || pathname === '/admin' || pathname === '/org'
    }
    
    // For other links, check exact match or if pathname starts with href followed by / or end of string
    // This prevents /admin/users from matching /admin/organizations
    if (pathname === href) return true
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
            <div className="mt-8 flex flex-col gap-2">
              {navLinks.map((link) => (
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
          </div>

          {/* User Profile Section */}
          <div className="border-t border-blue-200 pt-4 space-y-2">
            {user && (
              <>
                <div className={cn(
                  "flex items-center py-2 rounded-lg hover:bg-blue-100 transition-colors",
                  open ? "gap-3 px-3" : "justify-center px-0"
                )}>
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
                      <div className="text-xs text-gray-500 truncate">
                        {user.email}
                      </div>
                    </div>
                  )}
                </div>

                {/* Organization/Shop Selectors */}
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
              {open && (
                <span className="text-sm font-medium transition-opacity duration-200">
                  Logout
                </span>
              )}
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


