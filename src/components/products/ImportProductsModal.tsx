'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { parseCSV } from '@/lib/utils/csv'

// Maps a normalized CSV header (lowercased, alphanumerics only) to an ImportRow key.
const HEADER_MAP: Record<string, string> = {
  name: 'name',
  price: 'price',
  retailprice: 'price',
  unit: 'unit',
  costprice: 'costPrice',
  cost: 'costPrice',
  tradeprice: 'tradePrice',
  trade: 'tradePrice',
  wholesale: 'tradePrice',
  cartonprice: 'cartonPrice',
  cartonsize: 'cartonSize',
  cartonbarcode: 'cartonBarcode',
  barcode: 'barcode',
  sku: 'sku',
  category: 'category',
  reorderlevel: 'reorderLevel',
  trackstock: 'trackStock',
}

const TEMPLATE_HEADERS = [
  'name', 'price', 'unit', 'costPrice', 'tradePrice', 'barcode', 'sku',
  'category', 'cartonSize', 'cartonPrice', 'cartonBarcode', 'reorderLevel', 'trackStock',
]
const TEMPLATE_SAMPLE =
  'PVC PIPE 1IN,250,foot,180,210,,,Plumbing,,,,10,yes\n' +
  'CEMENT BAG 50KG,1350,bag,1200,1300,8901234567890,,Building,,,,5,yes'

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

function mapRows(raw: Record<string, string>[]): Record<string, string>[] {
  return raw.map((r) => {
    const out: Record<string, string> = {}
    for (const key of Object.keys(r)) {
      const mapped = HEADER_MAP[norm(key)]
      if (mapped) out[mapped] = r[key]
    }
    return out
  })
}

interface ImportResult {
  created: number
  skipped: number
  errors: Array<{ row: number; name: string; message: string }>
}

export default function ImportProductsModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  function reset() {
    setRows([])
    setFileName('')
    setParseError('')
    setResult(null)
    setError('')
  }

  function ingest(text: string) {
    setParseError('')
    setResult(null)
    try {
      const parsed = mapRows(parseCSV(text)).filter((r) => Object.keys(r).length > 0)
      if (parsed.length === 0) {
        setParseError('No rows found. Check the header row matches the template.')
        setRows([])
        return
      }
      if (!parsed.some((r) => 'name' in r) || !parsed.some((r) => 'price' in r)) {
        setParseError('CSV must have at least "name" and "price" columns.')
        setRows([])
        return
      }
      setRows(parsed)
    } catch {
      setParseError('Could not parse the file as CSV.')
      setRows([])
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => ingest(String(reader.result || ''))
    reader.readAsText(file)
  }

  function downloadTemplate() {
    const csv = TEMPLATE_HEADERS.join(',') + '\n' + TEMPLATE_SAMPLE + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cartpos-products-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    if (rows.length === 0 || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult({ created: data.created, skipped: data.skipped, errors: data.errors || [] })
      if (data.created > 0) onDone()
    } catch (e: any) {
      setError(e.message || 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  const previewCols = ['name', 'price', 'unit', 'tradePrice', 'barcode', 'category']

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Import products (CSV)"
      size="lg"
    >
      {!result ? (
        <div className="space-y-4">
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            Upload a CSV to add many products at once. Required columns: <b>name</b>, <b>price</b>.
            Optional: unit, costPrice, tradePrice, barcode, sku, category, cartonSize, cartonPrice,
            cartonBarcode, reorderLevel, trackStock. Stock is not set here. add it via Purchases.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="btn btn-outline h-9 px-4 cursor-pointer">
              <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
              Choose CSV file
            </label>
            <button type="button" onClick={downloadTemplate} className="text-sm font-medium text-orange-600 hover:underline">
              Download template
            </button>
            {fileName && <span className="text-sm text-[hsl(var(--muted-foreground))]">{fileName}</span>}
          </div>

          {parseError && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{parseError}</div>}
          {error && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{error}</div>}

          {rows.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">{rows.length} rows ready. Preview (first 8):</div>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-[hsl(var(--muted))]">
                    <tr>
                      {previewCols.map((c) => (
                        <th key={c} className="px-2 py-1.5 text-left font-semibold">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t">
                        {previewCols.map((c) => (
                          <td key={c} className="px-2 py-1.5">{r[c] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { reset(); onClose() }} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={rows.length === 0 || submitting}>
              {submitting ? 'Importing...' : `Import ${rows.length || ''} products`}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs uppercase text-emerald-700">Created</div>
              <div className="text-2xl font-bold text-emerald-700">{result.created}</div>
            </div>
            <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
              <div className="text-xs uppercase text-orange-700">Skipped</div>
              <div className="text-2xl font-bold text-orange-700">{result.skipped}</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1">Skipped rows:</div>
              <div className="max-h-48 overflow-y-auto border rounded-md text-xs">
                {result.errors.map((e, i) => (
                  <div key={i} className="px-2 py-1 border-t first:border-t-0">
                    Row {e.row}{e.name ? ` (${e.name})` : ''}: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={() => { reset(); onClose() }}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
