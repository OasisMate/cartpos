/**
 * Print utility for 80mm thermal receipts
 * Includes debug mode to visualize printable area
 * Supports WebUSB for silent printing without browser dialog
 */

export interface PrintOptions {
  silent?: boolean
  debug?: boolean // Show printable area boundaries
  useWebUSB?: boolean // Try WebUSB first if available
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

// WebUSB types
interface USBDevice {
  open(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>
  close(): Promise<void>
  vendorId: number
  productId: number
  productName?: string
  manufacturerName?: string
}

interface USB extends EventTarget {
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>
  getDevices(): Promise<USBDevice[]>
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[]
}

interface USBDeviceFilter {
  vendorId?: number
  productId?: number
  classCode?: number
  subclassCode?: number
  protocolCode?: number
}

interface USBOutTransferResult {
  status: 'ok' | 'stall' | 'babble'
  bytesWritten: number
}

declare global {
  interface Navigator {
    usb?: USB
  }
}

// ESC/POS command constants
const ESC = '\x1B'
const GS = '\x1D'

// Common thermal printer vendor IDs (add your printer's VID if needed)
const COMMON_PRINTER_VENDORS = [
  0x04f9, // Brother
  0x0483, // STMicroelectronics (common for generic thermal printers)
  0x20d1, // Xprinter
  0x154f, // Bixolon
  0x04e8, // Samsung (some thermal printers)
]

// Store connected printer device
let connectedPrinter: USBDevice | null = null

export async function printReceipt(elementId: string, options: PrintOptions = {}) {
  const { debug = false, silent = false, useWebUSB = false } = options
  const element = document.getElementById(elementId)
  if (!element) {
    window.print()
    return
  }

  // Priority 1: Electron silent print (if available and silent requested)
  if (silent && typeof window !== 'undefined' && window.electronAPI?.isElectron) {
    const htmlContent = element.innerHTML
    try {
      await window.electronAPI.printReceipt(htmlContent)
      console.log('Receipt printed silently via Electron')
      return
    } catch (err) {
      console.error('Electron print failed, falling back:', err)
      // Continue to next method
    }
  }

  // Priority 2: WebUSB silent print (if requested and available)
  if ((silent || useWebUSB) && isWebUSBAvailable()) {
    try {
      const htmlContent = element.innerHTML
      const textContent = extractTextFromHTML(htmlContent)
      const escposCommands = convertToESCPOS(textContent)
      
      await printViaWebUSB(escposCommands)
      console.log('Receipt printed silently via WebUSB')
      return
    } catch (err) {
      console.error('WebUSB print failed, falling back to browser print:', err)
      // Continue to browser print fallback
    }
  }

  // Priority 3: Browser print (works well with thermal printers)
  fallbackBrowserPrint(element, debug)
}

/**
 * Check if WebUSB API is available in the browser
 */
function isWebUSBAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator && navigator.usb !== undefined
}

/**
 * Connect to a USB thermal printer via WebUSB
 * User will be prompted to select the device on first use
 */
export async function connectWebUSBPrinter(): Promise<USBDevice | null> {
  if (!isWebUSBAvailable()) {
    throw new Error('WebUSB API is not available in this browser. Use Chrome or Edge.')
  }

  try {
    // First, try to get already authorized devices
    const devices = await navigator.usb!.getDevices()
    if (devices.length > 0) {
      connectedPrinter = devices[0]
      return connectedPrinter
    }

    // If no authorized devices, request access
    // Common USB printer class code is 7 (Printer)
    const device = await navigator.usb!.requestDevice({
      filters: [
        { classCode: 7 }, // Printer class
        ...COMMON_PRINTER_VENDORS.map(vid => ({ vendorId: vid })),
      ],
    })

    connectedPrinter = device
    return device
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      throw new Error('No USB printer found. Please connect a printer and try again.')
    }
    throw err
  }
}

/**
 * Print ESC/POS commands via WebUSB
 */
async function printViaWebUSB(commands: Uint8Array): Promise<void> {
  if (!connectedPrinter) {
    // Try to connect if not already connected
    await connectWebUSBPrinter()
  }

  if (!connectedPrinter) {
    throw new Error('No printer connected')
  }

  try {
    // Open device
    await connectedPrinter.open()

    // Most thermal printers use configuration 1, interface 0
    try {
      await connectedPrinter.selectConfiguration(1)
    } catch {
      // Some devices don't need explicit configuration
    }

    try {
      await connectedPrinter.claimInterface(0)
    } catch {
      // Interface might already be claimed
    }

    // Send data to endpoint 1 (usually the bulk out endpoint for printers)
    // Some printers use endpoint 2, you may need to adjust based on your printer
    const endpointNumber = 1
    const result = await connectedPrinter.transferOut(endpointNumber, commands)

    if (result.status !== 'ok') {
      throw new Error(`Print failed with status: ${result.status}`)
    }

    // Release interface and close (optional, can keep connection open for faster subsequent prints)
    // await connectedPrinter.releaseInterface(0)
    // await connectedPrinter.close()
  } catch (err) {
    // Reset connection on error
    connectedPrinter = null
    throw err
  }
}

/**
 * Extract plain text from HTML content
 */
function extractTextFromHTML(html: string): string {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = html

  // Remove script and style elements
  const scripts = tempDiv.querySelectorAll('script, style')
  scripts.forEach(el => el.remove())

  // Get text content and clean it up
  let text = tempDiv.textContent || tempDiv.innerText || ''
  
  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()

  return text
}

/**
 * Convert text content to ESC/POS commands for thermal printers
 */
function convertToESCPOS(text: string): Uint8Array {
  const commands: number[] = []

  // Initialize printer
  commands.push(...encodeString(ESC + '@')) // Reset printer

  // Set character encoding (UTF-8)
  commands.push(...encodeString(ESC + '\x74\x10')) // Select character code table 16 (UTF-8)

  // Set 80mm paper width
  commands.push(...encodeString(GS + 'W' + String.fromCharCode(0x50, 0x00))) // 80mm = 0x50

  // Set left margin (5.5mm for 80mm paper)
  commands.push(...encodeString(GS + 'L' + String.fromCharCode(0x44, 0x01))) // ~340 dots at 203 DPI

  // Split text into lines and process
  const lines = text.split('\n')
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (!line) {
      // Empty line - add small spacing
      commands.push(...encodeString('\n'))
      continue
    }

    // Check for common formatting patterns
    if (line.match(/^[A-Z\s]+$/) && line.length < 30) {
      // Likely a header (all caps, short) - make it bold and centered
      commands.push(...encodeString(ESC + 'a' + '\x01')) // Center align
      commands.push(...encodeString(ESC + 'E' + '\x01')) // Bold on
      commands.push(...encodeString(line + '\n'))
      commands.push(...encodeString(ESC + 'E' + '\x00')) // Bold off
      commands.push(...encodeString(ESC + 'a' + '\x00')) // Left align
    } else if (line.includes('---') || line.includes('===')) {
      // Separator line
      commands.push(...encodeString('─'.repeat(32) + '\n'))
    } else {
      // Regular line
      // Handle text that might be too long (wrap at ~32 chars for 80mm)
      const wrappedLines = wrapText(line, 32)
      wrappedLines.forEach(wrappedLine => {
        commands.push(...encodeString(wrappedLine + '\n'))
      })
    }
  }

  // Add some feed lines at the end
  commands.push(...encodeString('\n\n\n'))

  // Cut paper (partial cut)
  commands.push(...encodeString(GS + 'V' + '\x41' + '\x03'))

  return new Uint8Array(commands)
}

/**
 * Encode string to UTF-8 bytes
 */
function encodeString(str: string): number[] {
  const encoder = new TextEncoder()
  return Array.from(encoder.encode(str))
}

/**
 * Wrap text to fit within specified width
 */
function wrapText(text: string, width: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if ((currentLine + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) {
        lines.push(currentLine)
      }
      // If word itself is longer than width, split it
      if (word.length > width) {
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.substring(i, i + width))
        }
        currentLine = ''
      } else {
        currentLine = word
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.length > 0 ? lines : [text]
}

/**
 * Get currently connected WebUSB printer info
 */
export function getConnectedPrinterInfo(): { vendorId?: number; productId?: number; name?: string } | null {
  if (!connectedPrinter) return null
  
  return {
    vendorId: connectedPrinter.vendorId,
    productId: connectedPrinter.productId,
    name: connectedPrinter.productName || connectedPrinter.manufacturerName,
  }
}

/**
 * Disconnect WebUSB printer
 */
export async function disconnectWebUSBPrinter(): Promise<void> {
  if (connectedPrinter) {
    try {
      await connectedPrinter.close()
    } catch (err) {
      console.error('Error closing printer connection:', err)
    }
    connectedPrinter = null
  }
}

function fallbackBrowserPrint(element: HTMLElement, debug: boolean) {
  // Clone the element and clean up any Next.js asset references
  const clonedElement = element.cloneNode(true) as HTMLElement
  
  // Remove any script tags or problematic elements that might reference Next.js assets
  const scripts = clonedElement.querySelectorAll('script')
  scripts.forEach(script => script.remove())
  
  // Remove style tags that might have Next.js references
  const styles = clonedElement.querySelectorAll('style')
  styles.forEach(style => {
    const content = style.textContent || ''
    // Keep only print-related styles, remove any that reference Next.js
    if (content.includes('_next') || content.includes('undefined')) {
      style.remove()
    }
  })
  
  // Fix any image src attributes that might be broken
  const images = clonedElement.querySelectorAll('img')
  images.forEach(img => {
    const src = img.getAttribute('src')
    if (src && (src.startsWith('/_next/') || src.includes('undefined'))) {
      img.remove() // Remove broken image references
    }
  })
  
  // Remove any links that might reference Next.js assets
  const links = clonedElement.querySelectorAll('link')
  links.forEach(link => {
    const href = link.getAttribute('href')
    if (href && (href.startsWith('/_next/') || href.includes('undefined'))) {
      link.remove()
    }
  })
  
  // Get clean HTML content
  const htmlContent = clonedElement.innerHTML

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

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = () => iframe.remove()
    iframe.contentWindow.print()
  }
  
  setTimeout(() => iframe.remove(), 3000)
}
