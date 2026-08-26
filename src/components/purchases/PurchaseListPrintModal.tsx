'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { printReceipt } from '@/lib/utils/print'
import PurchaseListDocument, { type PurchaseListDocumentProps } from './PurchaseListDocument'

type PaperSize = '80mm' | 'a4'

interface PurchaseListPrintModalProps {
  isOpen: boolean
  onClose: () => void
  list: PurchaseListDocumentProps['list']
  shop: PurchaseListDocumentProps['shop']
  /** Called once a print actually goes through, e.g. so the caller can mark the list SENT. */
  onPrinted?: () => void
}

const printElementId = 'purchase-list-print-content'

export default function PurchaseListPrintModal({ isOpen, onClose, list, shop, onPrinted }: PurchaseListPrintModalProps) {
  const [paper, setPaper] = useState<PaperSize>('80mm')
  const [isPrinting, setIsPrinting] = useState(false)
  // The sale receipt puts the shop's logo in its header, honouring the shop's
  // receiptHeaderDisplay setting. The list is the same paperwork, so it reads
  // the same setting. Fetched when the modal opens rather than on every render
  // of the builder, since it is only ever needed on paper.
  const [branding, setBranding] = useState<{ logoUrl: string | null; headerDisplay: string } | null>(null)

  useEffect(() => {
    if (!isOpen || branding) return
    let cancelled = false
    fetch('/api/shop/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.settings) return
        setBranding({
          logoUrl: data.settings.logoUrl ?? null,
          headerDisplay: data.settings.receiptHeaderDisplay || 'NAME_ONLY',
        })
      })
      .catch(() => {
        // The list prints fine without a logo; never block a print on branding.
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, branding])

  // Same rule the receipt uses: the logo shows unless the shop asked for name only.
  const showLogo = branding?.headerDisplay === 'LOGO_ONLY' || branding?.headerDisplay === 'BOTH'
  const showName = !branding || branding.headerDisplay !== 'LOGO_ONLY'
  const printShop = {
    ...shop,
    name: showName ? shop.name || 'Shop' : null,
    logoUrl: showLogo ? branding?.logoUrl ?? null : null,
  }

  async function handlePrint() {
    setIsPrinting(true)
    try {
      await printReceipt(printElementId, { silent: true, paper })
      onPrinted?.()
    } catch (err) {
      console.error('Print failed:', err)
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <Modal open={isOpen} onClose={onClose} title="Purchase List" size="xl">
      <div className="flex justify-center gap-2 mb-4">
        <Button
          variant={paper === '80mm' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setPaper('80mm')}
          disabled={isPrinting}
        >
          80mm
        </Button>
        <Button
          variant={paper === 'a4' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setPaper('a4')}
          disabled={isPrinting}
        >
          A4
        </Button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
        <PurchaseListDocument id={printElementId} paper={paper} shop={printShop} list={list} />
      </div>

      <div className="mt-4 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPrinting}>
          Close
        </Button>
        <Button autoFocus className="flex-1" onClick={handlePrint} disabled={isPrinting}>
          {isPrinting ? 'Printing...' : 'Print'}
        </Button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #${printElementId}, #${printElementId} * { visibility: visible; }
          #${printElementId} {
            position: absolute;
            left: 0;
            right: 0;
            margin: 0 auto;
            width: ${paper === '80mm' ? '80mm' : '190mm'};
            top: 0;
          }
        }
      `}} />
    </Modal>
  )
}
