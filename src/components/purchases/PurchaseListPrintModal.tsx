'use client'

import { useState } from 'react'
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
}

const printElementId = 'purchase-list-print-content'

export default function PurchaseListPrintModal({ isOpen, onClose, list, shop }: PurchaseListPrintModalProps) {
  const [paper, setPaper] = useState<PaperSize>('80mm')
  const [isPrinting, setIsPrinting] = useState(false)

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
        <PurchaseListDocument id={printElementId} paper={paper} shop={shop} list={list} />
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
