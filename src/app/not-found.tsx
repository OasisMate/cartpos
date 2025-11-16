'use client'

export default function NotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-3xl font-bold mb-2">Page not found</h1>
      <p className="text-gray-600 mb-6">The page you are looking for doesn’t exist.</p>
      <a href="/" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Go to Dashboard
      </a>
    </div>
  )
}


