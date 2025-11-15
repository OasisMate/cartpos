import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">CartPOS</h1>
        <p className="text-gray-600 mb-8">Offline-first POS for small retail shops</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/pos"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to POS
          </Link>
          <Link
            href="/backoffice"
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Go to Backoffice
          </Link>
          <Link
            href="/admin"
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Go to Admin
          </Link>
        </div>
      </div>
    </div>
  )
}

