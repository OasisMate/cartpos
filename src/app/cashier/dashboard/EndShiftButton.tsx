'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils/money'

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
                variant="danger"
                onClick={() => setShowModal(true)}
                className="w-full md:w-auto"
            >
                End Shift
            </Button>

            <Modal open={showModal} onClose={() => setShowModal(false)} title="End Shift Summary" size="sm">
                <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                        <span className="text-[hsl(var(--muted-foreground))]">Total Invoices:</span>
                        <span className="font-medium">{summary.invoiceCount}</span>
                    </div>
                    <div className="border-t border-[hsl(var(--border))] my-2"></div>
                    <div className="flex justify-between">
                        <span>Cash Sales:</span>
                        <span className="font-medium">{formatCurrency(summary.cashSales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Card Sales:</span>
                        <span className="font-medium">{formatCurrency(summary.cardSales)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Udhaar (Credit):</span>
                        <span className="font-medium">{formatCurrency(summary.udhaarSales)}</span>
                    </div>
                    <div className="border-t border-[hsl(var(--border))] my-2"></div>
                    <div className="flex justify-between text-lg font-bold">
                        <span>Total Sales:</span>
                        <span>{formatCurrency(summary.totalSales)}</span>
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
                        variant="danger"
                        onClick={() => {
                            // Clear the session cookie via middleware, then land on login.
                            window.location.href = '/login?clearSession=1'
                        }}
                        className="flex-1"
                    >
                        Logout
                    </Button>
                </div>
            </Modal>
        </>
    )
}
