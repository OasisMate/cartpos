'use client'

import { useState } from 'react'

export function useConfirm() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string>('')
  const [resolveRef, setResolveRef] = useState<((v: boolean) => void) | null>(null)

  function confirm(msg: string) {
    setMessage(msg)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      setResolveRef(() => resolve)
    })
  }

  function onClose(result: boolean) {
    setOpen(false)
    if (resolveRef) {
      resolveRef(result)
      setResolveRef(null)
    }
  }

  function Dialog() {
    if (!open) return null
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40" onClick={() => onClose(false)} />
        <div className="relative bg-white rounded-lg shadow p-6 w-full max-w-md">
          <div className="text-gray-800 mb-4">{message}</div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => onClose(false)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onClose(true)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )
  }

  return { confirm, ConfirmDialog: Dialog }
}


