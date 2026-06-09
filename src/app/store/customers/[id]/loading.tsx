import { Skeleton, SkeletonCards } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-56" />
      <SkeletonCards count={3} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}
