'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import { connectWebUSBPrinter, getConnectedPrinterInfo, disconnectWebUSBPrinter } from '@/lib/utils/print'

/**
 * Component for setting up WebUSB printer connection
 * Users can connect their USB thermal printer once, and it will be remembered
 */
export default function WebUSBPrinterSetup() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printerInfo, setPrinterInfo] = useState<{ vendorId?: number; productId?: number; name?: string } | null>(null)

  // Check for existing connection on mount
  useEffect(() => {
    const info = getConnectedPrinterInfo()
    if (info) {
      setPrinterInfo(info)
    }
  }, [])

  async function handleConnect() {
    setIsConnecting(true)
    setError(null)
    
    try {
      const device = await connectWebUSBPrinter()
      if (device) {
        const info = getConnectedPrinterInfo()
        setPrinterInfo(info)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to printer')
      console.error('Printer connection error:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectWebUSBPrinter()
      setPrinterInfo(null)
    } catch (err) {
      console.error('Error disconnecting printer:', err)
    }
  }

  // Check if WebUSB is available
  const isWebUSBAvailable = typeof navigator !== 'undefined' && 'usb' in navigator

  if (!isWebUSBAvailable) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          WebUSB is not available in this browser. Please use Chrome or Edge for USB printer support.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-sm font-semibold mb-2">USB Printer Connection</h3>
      
      {printerInfo ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            Connected: <span className="font-medium">{printerInfo.name || `Printer (VID: ${printerInfo.vendorId?.toString(16)}, PID: ${printerInfo.productId?.toString(16)})`}</span>
          </p>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            Connect your USB thermal printer for silent printing without browser dialogs.
          </p>
          <Button onClick={handleConnect} disabled={isConnecting} size="sm">
            {isConnecting ? 'Connecting...' : 'Connect Printer'}
          </Button>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-3">
        Note: On Windows, you may need to install a generic USB driver using Zadig if your printer is already claimed by another driver.
      </p>
    </div>
  )
}

