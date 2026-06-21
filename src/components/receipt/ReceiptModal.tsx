'use client'

import { useState, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Button from '@/components/ui/Button'
import { printReceipt } from '@/lib/utils/print'
import { trapTab } from '@/lib/utils/focusTrap'
import ShareWhatsAppButton from './ShareWhatsAppButton'
import ReceiptDocument from './ReceiptDocument'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  invoice: {
    id: string
    number?: string
    createdAt: string
    shop?: {
      name: string
      city?: string | null
      phone?: string | null
      addressLine1?: string | null
      addressLine2?: string | null
      settings?: {
        logoUrl?: string | null
        receiptHeaderDisplay?: 'NAME_ONLY' | 'LOGO_ONLY' | 'BOTH'
        printerName?: string | null
      } | null
    } | null
    lines: Array<{
      id: string
      product: { name: string }
      quantity: string | number
      unitPrice: string | number
      lineTotal: string | number
    }>
    subtotal: string | number
    discount: string | number
    total: string | number
    paymentStatus: 'PAID' | 'UDHAAR'
    paymentMethod?: 'CASH' | 'CARD' | 'OTHER' | null
    payments?: Array<{ amount: string | number }>
    // Optional customer info for Udhaar receipts
    customerName?: string | null
    customer?: {
      name?: string | null
    } | null
    /** Staff member who served the sale (first name shown on the receipt). */
    servedBy?: string | null
  }
  printElementId?: string
  /** When true, opens the print flow as soon as the receipt is visible (shop setting on POS). */
  autoPrint?: boolean
}

export default function ReceiptModal({
  isOpen,
  onClose,
  invoice,
  printElementId = 'receipt-print-content',
  autoPrint = false,
}: ReceiptModalProps) {
  const [isPrinting, setIsPrinting] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  function handleKeyDown(e: ReactKeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    trapTab(e, panelRef.current)
  }

  async function handlePrint() {
    setIsPrinting(true)
    try {
      await printReceipt(printElementId, { silent: true })
    } catch (err) {
      console.error('Print failed:', err)
    } finally {
      setIsPrinting(false)
    }
  }

  useEffect(() => {
    if (!isOpen || !autoPrint) return
    let raf1 = 0
    let raf2 = 0
    let cancelled = false
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(async () => {
        if (cancelled) return
        setIsPrinting(true)
        try {
          await printReceipt(printElementId, { silent: true })
        } catch (err) {
          console.error('Auto print failed:', err)
        } finally {
          if (!cancelled) setIsPrinting(false)
        }
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [isOpen, autoPrint, printElementId, invoice.id])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onKeyDown={handleKeyDown}>
        <div ref={panelRef} className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Receipt</h2>
          </div>

          {/* Receipt Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <ReceiptDocument invoice={invoice} id={printElementId} />
          </div>

          {/* Modal Footer Buttons */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPrinting}>
              Close
            </Button>
            <ShareWhatsAppButton invoice={invoice} />
            <Button autoFocus className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handlePrint} disabled={isPrinting}>
              {isPrinting ? 'Printing...' : 'Print'}
            </Button>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #${printElementId},
          #${printElementId} * {
            visibility: visible;
          }
          #${printElementId} {
            position: absolute;
            left: 0;
            right: 0;
            margin: 0 auto;
            width: 80mm;
            top: 0;
          }
        }
      `}} />
    </>
  )
}
