import Link from 'next/link'
import { prisma } from '@/lib/db/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Building2, Users, Store } from 'lucide-react'

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    redirect('/')
  }

  const [organizationsCount, shopsCount, usersCount, invoicesToday] = await Promise.all([
    prisma.organization.count(),
    prisma.shop.count(),
    prisma.user.count(),
    prisma.invoice.count({
      where: {
        createdAt: {
          gte: new Date(new Date().toDateString()), // today midnight
        },
        status: 'COMPLETED',
      },
    }),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent">
          Platform Admin Dashboard
        </h1>
        <p className="text-gray-600">Overview and quick actions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white transform transition-transform hover:scale-105">
          <div className="text-sm font-medium text-blue-100 mb-2">Organizations</div>
          <div className="text-4xl font-bold">{organizationsCount}</div>
          <div className="text-xs text-blue-100 mt-2">Total registered</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white transform transition-transform hover:scale-105">
          <div className="text-sm font-medium text-orange-100 mb-2">Shops</div>
          <div className="text-4xl font-bold">{shopsCount}</div>
          <div className="text-xs text-orange-100 mt-2">Active shops</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white transform transition-transform hover:scale-105">
          <div className="text-sm font-medium text-purple-100 mb-2">Users</div>
          <div className="text-4xl font-bold">{usersCount}</div>
          <div className="text-xs text-purple-100 mt-2">Total users</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white transform transition-transform hover:scale-105">
          <div className="text-sm font-medium text-green-100 mb-2">Invoices Today</div>
          <div className="text-4xl font-bold">{invoicesToday}</div>
          <div className="text-xs text-green-100 mt-2">Completed today</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/organizations"
          className="group bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-200 p-6 transition-all hover:border-blue-300"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <h2 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
              Organizations
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Review organization requests, approve or suspend organizations.
          </p>
        </Link>
        <Link
          href="/admin/users"
          className="group bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-200 p-6 transition-all hover:border-purple-300"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <h2 className="font-semibold text-lg text-gray-900 group-hover:text-purple-600 transition-colors">
              Users
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Manage user accounts, roles, and permissions.
          </p>
        </Link>
        <Link
          href="/admin/shops"
          className="group bg-white rounded-xl shadow-md hover:shadow-xl border border-gray-200 p-6 transition-all hover:border-orange-300"
        >
          <div className="flex items-center gap-4 mb-3">
            <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Store className="h-6 w-6 text-white" />
            </div>
            <h2 className="font-semibold text-lg text-gray-900 group-hover:text-orange-600 transition-colors">
              Shops
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Create and manage shops, view owners and statistics.
          </p>
        </Link>
      </div>
    </div>
  )
}

