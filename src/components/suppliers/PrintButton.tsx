'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn btn-primary h-9 px-4 inline-flex items-center gap-2 no-print"
    >
      <Printer className="h-4 w-4" />
      <span>Print</span>
    </button>
  )
}
