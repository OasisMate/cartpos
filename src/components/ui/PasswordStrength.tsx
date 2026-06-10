'use client'

import { passwordRequirements, passwordStrength } from '@/lib/validation/password'

/** Live password strength bar + requirement checklist. */
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null
  const { score, label } = passwordStrength(value)
  const reqs = passwordRequirements(value)
  const barColors = ['bg-red-500', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
  const textColors = ['text-red-600', 'text-red-600', 'text-yellow-600', 'text-blue-600', 'text-green-600']

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < score ? barColors[score] : 'bg-gray-200'}`}
          />
        ))}
      </div>
      {label && <p className={`text-xs font-medium mb-2 ${textColors[score]}`}>{label}</p>}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {reqs.map((r) => (
          <li key={r.label} className={`text-xs flex items-center gap-1 ${r.met ? 'text-green-600' : 'text-gray-400'}`}>
            <span>{r.met ? '✓' : '○'}</span>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
