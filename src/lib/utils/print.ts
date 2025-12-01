/**
 * Print utility for 80mm thermal receipts
 * Includes debug mode to visualize printable area
 */

export interface PrintOptions {
  printerName?: string
  silent?: boolean
  debug?: boolean // Show printable area boundaries
}

export function printReceipt(elementId: string, options: PrintOptions = {}) {
  const { debug = false } = options
  const element = document.getElementById(elementId)
  if (!element) {
    window.print()
    return
  }

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
  padding: 0 1mm;      /* small, even padding on both sides */
  width: 60mm;          /* SAFE content width for 80mm paper */
  max-width: 60mm;
  margin: 0;            /* we'll nudge slightly left instead of perfect centering */
  margin-left: 5.5mm;  /* small nudge left to reduce extra left whitespace */
  position: relative;
}

${debugStyle}

.shop-name { font-size:14pt; font-weight:700; text-align:center; }
.shop-address, .shop-phone { font-size:9pt; text-align:center; }

.sale-invoice { 
  font-size:10pt; font-weight:600; text-align:center; 
  margin:2mm 0; padding:1mm 0; 
  border-top:1px solid #000; border-bottom:1px solid #000; 
}

.info-grid { margin:1mm 0; }
.info-row { display:flex; font-size:9pt; margin:0; }
.info-col { flex:1; display:flex; gap:2mm; }
.label { font-weight:600; }

.divider { border-top:1px dashed #000; margin:1mm 0; }

table { width:100%; border-collapse:collapse; font-size:9pt; margin:1mm 0; }
thead tr { border-top:1px solid #000; border-bottom:1px solid #000; }
th, td { padding:0.3mm 0.5mm; text-align:left; margin:0; }
th { font-weight:700; }
tbody tr { margin:0; }
td.sn { width:6mm; }
td.item-name { word-break:break-word; max-width:24mm; }
td.price, td.qty, td.total { text-align:right; width:8mm; }
th.price, th.qty, th.total { text-align:right; width:8mm; }

.summary { margin-top:1mm; border-top:1px solid #000; padding-top:1mm; }
.summary-row { display:flex; justify-content:space-between; font-size:9pt; margin:0; }
.summary-row.total { font-size:11pt; font-weight:700; }

.footer { margin-top:1mm; padding-top:1mm; border-top:1px dashed #000; font-size:9pt; }
.footer-row { display:flex; justify-content:space-between; margin:0; }

@media print { 
  @page { margin:0; }
}
</style></head><body>${debug ? '<div class="debug-text">DEBUG: Red lines show printable area boundaries. Content should stay within.</div>' : ''}${element.innerHTML}</body></html>`)
  doc.close()

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = () => iframe.remove()
    iframe.contentWindow.print()
  }
  
  setTimeout(() => iframe.remove(), 3000)
}
