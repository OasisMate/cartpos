/**
 * Print utility for 80mm thermal receipts
 * Includes debug mode to visualize printable area
 */

export interface PrintOptions {
  printerName?: string
  silent?: boolean
  debug?: boolean // Show printable area boundaries
}

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI?: {
      printReceipt: (htmlContent: string) => Promise<{ success: boolean }>
      isElectron: boolean
    }
  }
}

export function printReceipt(elementId: string, options: PrintOptions = {}) {
  const { debug = false, silent = false } = options
  const element = document.getElementById(elementId)
  if (!element) {
    window.print()
    return
  }

  // Check if running in Electron and silent print is requested
  if (silent && typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    // Use Electron's silent print
    const htmlContent = element.innerHTML
    window.electronAPI
      .printReceipt(htmlContent)
      .then(() => {
        console.log('Receipt printed silently via Electron')
      })
      .catch((err) => {
        console.error('Electron print failed, falling back to browser print:', err)
        // Fallback to browser print
        fallbackBrowserPrint(element, debug)
      })
    return
  }

  // Fallback to browser print
  fallbackBrowserPrint(element, debug)
}

function fallbackBrowserPrint(element: HTMLElement, debug: boolean) {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)
  
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    window.print()
    return
  }

  // Debug mode: Show printable area boundaries
  const debugStyle = debug ? `
    body::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 1px;
      height: 100%;
      background: red;
      z-index: 9999;
    }
    body::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      width: 1px;
      height: 100%;
      background: red;
      z-index: 9999;
    }
    .debug-left { border-left: 2px solid red; }
    .debug-right { border-right: 2px solid red; }
    .debug-text {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      background: yellow;
      padding: 1mm;
      font-size: 6pt;
      z-index: 9999;
    }
  ` : ''

  doc.open()
  doc.write(`<!DOCTYPE html><html><head><style>
@page { size: 80mm auto; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.2;
  padding: 0 1mm;
  width: 60mm;
  max-width: 60mm;
  margin: 0;
  margin-left: 5.5mm;
  position: relative;
  background: white;
  color: #111827;
}

${debugStyle}

/* Tailwind utility classes for print */
.text-center { text-align: center !important; }
.mb-4 { margin-bottom: 4mm !important; }
.mb-1 { margin-bottom: 1mm !important; }
.mb-0\.5 { margin-bottom: 0.5mm !important; }
.text-2xl { font-size: 14pt !important; line-height: 1.2 !important; }
.font-bold { font-weight: 700 !important; }
.text-gray-900 { color: #111827 !important; }
.text-sm { font-size: 9pt !important; }
.text-gray-600 { color: #4b5563 !important; }
.py-2 { padding-top: 2mm !important; padding-bottom: 2mm !important; }
.border-y-2 { border-top: 2px solid #111827 !important; border-bottom: 2px solid #111827 !important; }
.my-3 { margin-top: 3mm !important; margin-bottom: 3mm !important; }
.text-base { font-size: 10pt !important; }
.font-semibold { font-weight: 600 !important; }
.space-y-1\.5 > * + * { margin-top: 1.5mm !important; }
.mb-3 { margin-bottom: 3mm !important; }
.flex { display: flex !important; }
.justify-between { justify-content: space-between !important; }
.border-t { border-top-width: 1px !important; border-top-style: solid !important; }
.border-dashed { border-style: dashed !important; }
.border-gray-400 { border-color: #9ca3af !important; }
.w-full { width: 100% !important; }
table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; margin: 1mm 0 !important; }
.border-b-2 { border-bottom: 2px solid #111827 !important; }
.text-left { text-align: left !important; }
.text-right { text-align: right !important; }
.py-1\.5 { padding-top: 1.5mm !important; padding-bottom: 1.5mm !important; }
th { font-weight: 700 !important; }
.border-b { border-bottom-width: 1px !important; border-bottom-style: solid !important; }
.border-gray-200 { border-color: #e5e7eb !important; }
.text-gray-700 { color: #374151 !important; }
.font-medium { font-weight: 500 !important; }
.text-red-600 { color: #dc2626 !important; }
.pt-1 { padding-top: 1mm !important; }
.border-gray-300 { border-color: #d1d5db !important; }
.text-green-600 { color: #16a34a !important; }
.pt-2 { padding-top: 2mm !important; }
.mt-2 { margin-top: 2mm !important; }

@media print { 
  @page { margin: 0; }
}
</style></head><body>${debug ? '<div class="debug-text">DEBUG: Red lines show printable area boundaries. Content should stay within.</div>' : ''}${element.innerHTML}</body></html>`)
  doc.close()

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = () => iframe.remove()
    iframe.contentWindow.print()
  }
  
  setTimeout(() => iframe.remove(), 3000)
}
