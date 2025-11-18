'use client'

interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

interface BreadcrumbProps {
  prefix?: string
  items: BreadcrumbItem[]
  actions?: React.ReactNode
}

export function Breadcrumb({ prefix, items, actions }: BreadcrumbProps) {
  if (!prefix && items.length === 0 && !actions) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-orange-50 px-4 py-2 text-sm text-blue-900 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {prefix && <span className="font-semibold text-blue-700">{prefix}</span>}
        {items.length > 0 && prefix && <span className="text-blue-400">|</span>}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2">
          {items.map((item, index) => (
            <div key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span className="text-blue-400">›</span>}
              {item.href ? (
                <a
                  href={item.href}
                  onClick={item.onClick}
                  className="font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
                >
                  {item.label}
                </a>
              ) : item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
                >
                  {item.label}
                </button>
              ) : (
                <span className="font-medium text-blue-900">{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

