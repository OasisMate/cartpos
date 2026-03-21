/**
 * Print utility for 80mm thermal receipts
 * Includes debug mode to visualize printable area
 */

export interface PrintOptions {
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

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/** Wait for receipt images (e.g. logo) so the print dialog does not open before they paint. */
function waitForImages(root: ParentNode, timeoutMs = 5000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[]
  if (imgs.length === 0) return Promise.resolve()
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && (img.naturalWidth > 0 || !img.getAttribute('src'))) {
            resolve()
            return
          }
          const t = setTimeout(() => resolve(), timeoutMs)
          const done = () => {
            clearTimeout(t)
            resolve()
          }
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }),
    ),
  ).then(() => undefined)
}

export async function printReceipt(elementId: string, options: PrintOptions = {}): Promise<void> {
  const { debug = false, silent = false } = options
  const element = document.getElementById(elementId)
  if (!element) {
    window.print()
    return
  }

  if (silent && typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    const htmlContent = element.innerHTML
    try {
      await window.electronAPI.printReceipt(htmlContent)
      return
    } catch (err) {
      console.error('Electron print failed, falling back to browser print:', err)
      await fallbackBrowserPrint(element, debug)
      return
    }
  }

  await fallbackBrowserPrint(element, debug)
}

function fallbackBrowserPrint(element: HTMLElement, debug: boolean): Promise<void> {
  return new Promise((resolve) => {
    const clonedElement = element.cloneNode(true) as HTMLElement

    const scripts = clonedElement.querySelectorAll('script')
    scripts.forEach((script) => script.remove())

    const styles = clonedElement.querySelectorAll('style')
    styles.forEach((style) => {
      const content = style.textContent || ''
      if (content.includes('_next') || content.includes('undefined')) {
        style.remove()
      }
    })

    const images = clonedElement.querySelectorAll('img')
    images.forEach((img) => {
      const src = img.getAttribute('src')
      if (src && (src.startsWith('/_next/') || src.includes('undefined'))) {
        img.remove()
      }
    })

    const links = clonedElement.querySelectorAll('link')
    links.forEach((link) => {
      const href = link.getAttribute('href')
      if (href && (href.startsWith('/_next/') || href.includes('undefined'))) {
        link.remove()
      }
    })

    const htmlContent = clonedElement.innerHTML

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) {
      window.print()
      resolve()
      return
    }

    const debugStyle = debug
      ? `
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
  `
      : ''

    doc.open()
    doc.write(`<!DOCTYPE html><html><head>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="data:,">
<base href="${window.location.origin}"><style>
@page { size: 80mm auto; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10pt;
  line-height: 1.3;
  padding: 0 1mm;
  padding-top: 0 !important;
  width: 60mm;
  max-width: 60mm;
  margin-top: 0 !important;
  margin-right: 0 !important;
  margin-bottom: 0 !important;
  margin-left: 5.5mm !important;
  position: relative;
  background: white;
  color: #000000;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
body > *:first-child {
  margin-top: 0 !important;
  padding-top: 0 !important;
}

${debugStyle}

/* Tailwind utility classes for print */
.text-center { text-align: center !important; }
.mb-4 { margin-bottom: 4mm !important; }
.mb-1 { margin-bottom: 1mm !important; }
.mb-0\.5 { margin-bottom: 0.5mm !important; }
.text-2xl { font-size: 14pt !important; line-height: 1.2 !important; }
.font-bold { font-weight: 700 !important; }
.text-gray-900 { color: #000000 !important; }
.text-sm { font-size: 9pt !important; }
.text-gray-600 { color: #000000 !important; }
.py-2 { padding-top: 2mm !important; padding-bottom: 2mm !important; }
.py-0\.5 { padding-top: 0.5mm !important; padding-bottom: 0.5mm !important; }
.my-0\.5 { margin-top: 0.5mm !important; margin-bottom: 0.5mm !important; }
.border-y-2 { border-top: 2px solid #111827 !important; border-bottom: 2px solid #111827 !important; }
.my-3 { margin-top: 3mm !important; margin-bottom: 3mm !important; }
.text-base { font-size: 10pt !important; }
.font-semibold { font-weight: 600 !important; }
.underline { text-decoration: underline !important; }
.font-normal { font-weight: 400 !important; }
span.font-normal { font-weight: 400 !important; }
span.font-semibold { font-weight: 600 !important; }
span.font-semibold span.font-normal { font-weight: 400 !important; }
.space-y-1\.5 > * + * { margin-top: 1.5mm !important; }
.mb-3 { margin-bottom: 3mm !important; }
.flex { display: flex !important; }
.justify-between { justify-content: space-between !important; }
.border-t { border-top-width: 1px !important; border-top-style: solid !important; }
.border-dashed { border-style: dashed !important; }
.border-gray-400 { border-color: #9ca3af !important; }
.w-full { width: 100% !important; }
table { width: 100% !important; border-collapse: collapse !important; font-size: 9pt !important; margin: 0 0 1mm 0 !important; }
.border-b-2 { border-bottom: 2px solid #111827 !important; }
.text-left { text-align: left !important; }
.text-right { text-align: right !important; }
.py-1\.5 { padding-top: 1.5mm !important; padding-bottom: 1.5mm !important; }
th { font-weight: 700 !important; }
.border-b { border-bottom-width: 1px !important; border-bottom-style: solid !important; }
.border-gray-200 { border-color: #e5e7eb !important; }
.text-gray-700 { color: #000000 !important; }
.font-medium { font-weight: 500 !important; }
.text-red-600 { color: #dc2626 !important; }
.pt-1 { padding-top: 1mm !important; }
.border-gray-300 { border-color: #d1d5db !important; }
.text-green-600 { color: #16a34a !important; }
.pt-2 { padding-top: 2mm !important; }
.mt-2 { margin-top: 2mm !important; }
.mx-auto { margin-left: auto !important; margin-right: auto !important; }
.max-w-\[200px\] { max-width: 200px !important; }
.max-h-\[80px\] { max-height: 80px !important; }
img { display: block !important; }

@media print { 
  @page { margin: 0; }
}
</style></head><body>${debug ? '<div class="debug-text">DEBUG: Red lines show printable area boundaries. Content should stay within.</div>' : ''}${htmlContent}</body></html>`)
    doc.close()

    const win = iframe.contentWindow
    if (!win) {
      iframe.remove()
      resolve()
      return
    }

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(safetyTimer)
      try {
        iframe.remove()
      } catch {
        /* ignore */
      }
      resolve()
    }

    const safetyTimer = setTimeout(finish, 2500)

    void (async () => {
      try {
        await waitForImages(doc.body)
        await doubleRaf()
        if (settled) return
        win.onafterprint = () => finish()
        win.print()
      } catch {
        finish()
      }
    })()
  })
}
