import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Settings as SettingsIcon } from 'lucide-react'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-orange-600 bg-clip-text text-transparent flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-blue-600" />
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your account and preferences</p>
      </div>

      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-md border border-gray-200 dark:border-neutral-700 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Account Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={user.name}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-gray-50 dark:bg-neutral-900 text-gray-500 dark:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-gray-50 dark:bg-neutral-900 text-gray-500 dark:text-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <input
              type="text"
              value={user.role}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-gray-50 dark:bg-neutral-900 text-gray-500 dark:text-gray-400"
            />
          </div>
        </div>
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          More settings coming soon...
        </p>
      </div>
    </div>
  )
}

