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
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/ui/Logo'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout, selectOrg, selectShop } = useAuth()
  const [open, setOpen] = useState(false)

  // Navigation links - show based on user role
  const getNavLinks = () => {
    const links = []

    // Dashboard - available to all authenticated users
    links.push({
      label: 'Dashboard',
      href: '/',
      icon: (
        <LayoutDashboard className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    })

    // Admin-only links
    if (user?.role === 'PLATFORM_ADMIN') {
      links.push({
        label: 'Organizations',
        href: '/admin/organizations',
        icon: (
          <Building2 className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />
        ),
      })
      links.push({
        label: 'Users',
        href: '/admin/users',
        icon: (
          <Users className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />
        ),
      })
      links.push({
        label: 'Shops',
        href: '/admin/shops',
        icon: (
          <Store className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />
        ),
      })
    }

    // Settings - available to all authenticated users
    links.push({
      label: 'Settings',
      href: '/settings',
      icon: (
        <Settings className="h-5 w-5 flex-shrink-0 text-neutral-700 dark:text-neutral-200" />
      ),
    })

    return links
  }

  const navLinks = getNavLinks()

  // Check if a link is active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/' || pathname === '/admin'
    }
    return pathname?.startsWith(href)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 bg-gradient-to-b from-blue-50 to-white dark:from-neutral-800 dark:to-neutral-900 border-r border-blue-200 dark:border-neutral-700">
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
                    'rounded-lg px-3 transition-all duration-200',
                    isActive(link.href)
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md [&_svg]:text-white'
                      : 'text-neutral-700 dark:text-neutral-200 hover:bg-blue-100 dark:hover:bg-neutral-700 hover:text-blue-700 dark:hover:text-blue-300'
                  )}
                />
              ))}
            </div>
          </div>

          {/* User Profile Section */}
          <div className="border-t border-blue-200 dark:border-neutral-700 pt-4">
            {user && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-neutral-700 transition-colors">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                {open && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 min-w-0"
                  >
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {user.name}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {user.email}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
            <button
              onClick={logout}
              className={cn(
                'w-full mt-2 flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
                'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
              )}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {open && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm font-medium"
                >
                  Logout
                </motion.span>
              )}
            </button>
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700 flex items-center justify-between px-6 shadow-sm">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
              CartPOS
            </h1>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              {user.role !== 'PLATFORM_ADMIN' &&
                user.organizations &&
                user.organizations.length > 1 && (
                  <select
                    value={user.currentOrgId || ''}
                    onChange={(e) => selectOrg(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {user.organizations.map((o) => (
                      <option key={o.orgId} value={o.orgId}>
                        {o.organization.name}
                      </option>
                    ))}
                  </select>
                )}
              {user.role !== 'PLATFORM_ADMIN' &&
                user.shops &&
                user.shops.length > 1 && (
                  <select
                    value={user.currentShopId || ''}
                    onChange={(e) => selectShop(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-neutral-900">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}


