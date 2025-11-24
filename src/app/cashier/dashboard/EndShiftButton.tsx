'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'

interface EndShiftProps {
    summary: {
        totalSales: number
        cashSales: number
        cardSales: number
        udhaarSales: number
        invoiceCount: number
    }
}

export default function EndShiftButton({ summary }: EndShiftProps) {
    const [showModal, setShowModal] = useState(false)

    return (
        <>
            <Button
                onClick={() => setShowModal(true)}
                className="w-full md:w-auto bg-red-600 hover:bg-red-700"
            >
                End Shift
            </Button>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[hsl(var(--card))] p-6 rounded-lg max-w-sm w-full border border-[hsl(var(--border))]">
                        <h2 className="text-xl font-bold mb-4">End Shift Summary</h2>

                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between">
                                <span className="text-[hsl(var(--muted-foreground))]">Total Invoices:</span>
                                <span className="font-medium">{summary.invoiceCount}</span>
                            </div>
                            <div className="border-t border-[hsl(var(--border))] my-2"></div>
                            <div className="flex justify-between">
                                <span>Cash Sales:</span>
                                <span className="font-medium">Rs.{summary.cashSales.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Card Sales:</span>
                                <span className="font-medium">Rs.{summary.cardSales.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Udhaar (Credit):</span>
                                <span className="font-medium">Rs.{summary.udhaarSales.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-[hsl(var(--border))] my-2"></div>
                            <div className="flex justify-between text-lg font-bold">
                                <span>Total Sales:</span>
                                <span>Rs.{summary.totalSales.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setShowModal(false)}
                                className="flex-1"
                            >
                                Close
                            </Button>
                            <Button
                                onClick={() => {
                                    // In a real app, this might trigger a logout or status update
                                    window.location.href = '/login'
                                }}
                                className="flex-1 bg-red-600 hover:bg-red-700"
                            >
                                Logout
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
