import { cn } from '@/lib/utils'

/**
 * User avatar: shows the uploaded profile photo when present, otherwise the
 * first letter of the name on a gradient circle. Size is controlled by the
 * caller via `className` (e.g. "h-7 w-7"). Uses a raw <img> because the photo
 * is a base64 data URL (no next/image domain config needed).
 */
export function UserAvatar({
  name,
  imageUrl,
  className,
}: {
  name?: string | null
  imageUrl?: string | null
  className?: string
}) {
  const base = 'rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden'

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || 'User'}
        className={cn(base, 'object-cover', className)}
      />
    )
  }

  return (
    <div className={cn(base, 'bg-gradient-to-br from-blue-500 to-orange-500', className)}>
      <span className="text-white font-semibold leading-none">
        {name?.[0]?.toUpperCase() || 'U'}
      </span>
    </div>
  )
}
