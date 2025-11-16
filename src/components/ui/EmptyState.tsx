export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="text-center py-12 text-gray-600">
      <div className="text-lg font-semibold text-gray-800 mb-1">{title}</div>
      {description && <div className="mb-4">{description}</div>}
      {action}
    </div>
  )
}


