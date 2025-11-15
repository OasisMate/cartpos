import Link from 'next/link'

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Platform Admin</h1>
      <p className="text-gray-600 mb-6">Platform Management</p>
      <div className="space-y-4">
        <Link
          href="/admin/shops"
          className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
        >
          <h2 className="font-semibold text-lg mb-2">Shops</h2>
          <p className="text-sm text-gray-600">
            Create and manage shops, view shop owners and statistics.
          </p>
        </Link>
      </div>
    </div>
  )
}

