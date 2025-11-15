'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const { user, logout, selectShop } = useAuth()
  const pathname = usePathname()

  // Don't show navbar on login page
  if (pathname === '/login') {
    return null
  }

  const currentShop = user?.shops?.find((s) => s.shopId === user.currentShopId)?.shop
  const hasMultipleShops = (user?.shops?.length || 0) > 1

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-gray-900">
                CartPOS
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {(user?.role === 'ADMIN' || user?.shops && user.shops.length > 0) && (
                <Link
                  href="/pos"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  POS
                </Link>
              )}
              {(user?.role === 'ADMIN' || user?.shops?.some((s) => s.shopRole === 'OWNER')) && (
                <>
                  <Link
                    href="/backoffice"
                    className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Backoffice
                  </Link>
                </>
              )}
              {user?.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {hasMultipleShops && user?.shops && (
              <select
                value={user.currentShopId || ''}
                onChange={(e) => selectShop(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-blue-500"
              >
                {user.shops.map((s) => (
                  <option key={s.shopId} value={s.shopId}>
                    {s.shop.name}
                  </option>
                ))}
              </select>
            )}
            {currentShop && !hasMultipleShops && (
              <span className="text-sm text-gray-600">{currentShop.name}</span>
            )}
            {user && (
              <>
                <span className="text-sm text-gray-600">{user.name}</span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Logout
                </button>
              </>
            )}
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-gray-600 text-sm">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

