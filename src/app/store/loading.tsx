import { BrandSpinner } from '@/components/ui/BrandSpinner'

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <BrandSpinner size={44} />
    </div>
  )
}
