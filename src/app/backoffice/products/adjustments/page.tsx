'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getPendingStockAdjustments, CachedStockAdjustment } from '@/lib/offline/indexedDb'
import Button from '@/components/ui/Button'

export default function StockAdjustmentsPage() {
    const { user } = useAuth()
    const [pendingAdjustments, setPendingAdjustments] = useState<CachedStockAdjustment[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadPending() {
            if (!user?.currentShopId) return
            try {
                const pending = await getPendingStockAdjustments(user.currentShopId)
                setPendingAdjustments(pending)
            } catch (err) {
                console.error('Failed to load pending adjustments:', err)
            } finally {
                setLoading(false)
            }
        }

        loadPending()
    }, [user?.currentShopId])

    if (!user?.currentShopId) return null

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Stock Adjustments</h1>
                <Link href="/backoffice/products/adjustments/new">
                    <Button>New Adjustment</Button>
                </Link>
            </div>

            <div className="bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] p-4 mb-6">
                <h2 className="text-lg font-semibold mb-4">Pending Sync ({pendingAdjustments.length})</h2>
                {loading ? (
                    <div>Loading...</div>
                ) : pendingAdjustments.length === 0 ? (
                    <div className="text-[hsl(var(--muted-foreground))]">No pending adjustments</div>
                ) : (
                    <div className="space-y-2">
                        {pendingAdjustments.map((adj) => (
                            <div key={adj.id} className="flex justify-between items-center p-3 bg-[hsl(var(--muted))] rounded">
                                <div>
                                    <div className="font-medium">{adj.type}</div>
                                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                        Product ID: {adj.productId} • Qty: {adj.quantity}
                                    </div>
                                    {adj.syncError && (
                                        <div className="text-xs text-red-500 mt-1">Error: {adj.syncError}</div>
                                    )}
                                </div>
                                <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                    {new Date(adj.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] p-4">
                <h2 className="text-lg font-semibold mb-4">Recent Adjustments</h2>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Server-side list not implemented yet. Only pending offline adjustments are shown above.
                </p>
            </div>
        </div>
    )
}
