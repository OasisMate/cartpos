import { BrandSpinner } from '@/components/ui/BrandSpinner'

export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <BrandSpinner size={44} />
    </div>
  )
}
