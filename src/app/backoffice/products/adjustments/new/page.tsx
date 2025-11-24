'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { searchCachedProducts, Product } from '@/lib/offline/products'
import { saveStockAdjustment } from '@/lib/offline/inventory'
import { cuid } from '@/lib/utils/cuid'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

export default function NewStockAdjustmentPage() {
    const { user } = useAuth()
    const router = useRouter()
    const { show } = useToast()
    const isOnline = useOnlineStatus()

    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<Product[]>([])
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

    const [type, setType] = useState<'DAMAGE' | 'EXPIRY' | 'RETURN' | 'SELF_USE' | 'ADJUSTMENT'>('DAMAGE')
    const [quantity, setQuantity] = useState('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (!searchTerm.trim() || !user?.currentShopId) {
            setSearchResults([])
            return
        }

        const timer = setTimeout(async () => {
            try {
                const results = await searchCachedProducts(user.currentShopId!, searchTerm)
                setSearchResults(results)
            } catch (err) {
                console.error('Search error:', err)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [searchTerm, user?.currentShopId])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!user?.currentShopId || !selectedProduct || !quantity) return

        setSubmitting(true)
        try {
            const adjustment = {
                id: cuid(),
                shopId: user.currentShopId,
                productId: selectedProduct.id,
                quantity: parseFloat(quantity) * (type === 'RETURN' ? 1 : -1), // Convention: adjustments usually reduce stock unless it's a return? 
                // Wait, usually user enters positive quantity for "Damage" meaning "5 damaged". 
                // The backend should handle the sign based on type, or I should send the raw quantity and type.
                // The schema says `quantity Int`. 
                // If I send positive quantity for DAMAGE, the backend needs to know to subtract.
                // My `StockLedger` usually stores the change amount.
                // Let's assume the backend expects the *change* amount or handles logic.
                // For now, I will send the signed quantity based on type.
                // DAMAGE, EXPIRY, SELF_USE = negative.
                // RETURN = positive.
                // ADJUSTMENT = could be either, but usually used for corrections.
                // Let's stick to: User enters positive number. I convert to negative for loss types.
                // Actually, `StockMoveType` in schema is just an enum.
                // The `StockLedger` stores `quantity`.
                // If I have 5 damaged items, I lose 5 items. So quantity should be -5.
                // If I have a return, I gain items. So quantity +5.
                // I'll implement this logic here.

                // Logic:
                // DAMAGE, EXPIRY, SELF_USE -> Negative
                // RETURN -> Positive
                // ADJUSTMENT -> User enters signed value? Or separate "Add" / "Remove" options?
                // For simplicity, let's assume user enters positive for "Loss" types and I negate it.

                type: type,
                notes: notes
            }

            // Override quantity logic
            let finalQty = parseFloat(quantity)
            if (['DAMAGE', 'EXPIRY', 'SELF_USE'].includes(type)) {
                finalQty = -Math.abs(finalQty)
            }
            // For RETURN, keep positive.
            // For ADJUSTMENT, keep as is (user can enter negative).

            await saveStockAdjustment({
                ...adjustment,
                quantity: finalQty
            }, isOnline)

            show({ message: 'Adjustment saved', variant: 'success' })
            router.push('/backoffice/products/adjustments')
        } catch (err) {
            console.error('Error saving adjustment:', err)
            show({ message: 'Failed to save adjustment', variant: 'destructive' })
        } finally {
            setSubmitting(false)
        }
    }

    if (!user?.currentShopId) return null

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">New Stock Adjustment</h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-[hsl(var(--card))] p-6 rounded-lg border border-[hsl(var(--border))]">

                {/* Product Search */}
                <div>
                    <label className="block text-sm font-medium mb-1">Product</label>
                    {selectedProduct ? (
                        <div className="flex items-center justify-between p-3 border rounded bg-[hsl(var(--muted))]">
                            <div>
                                <div className="font-medium">{selectedProduct.name}</div>
                                <div className="text-sm text-[hsl(var(--muted-foreground))]">{selectedProduct.barcode}</div>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
                                Change
                            </Button>
                        </div>
                    ) : (
                        <div className="relative">
                            <Input
                                placeholder="Search product by name or barcode..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full"
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {searchResults.map((product) => (
                                        <button
                                            key={product.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedProduct(product)
                                                setSearchTerm('')
                                                setSearchResults([])
                                            }}
                                            className="w-full px-4 py-2 text-left hover:bg-[hsl(var(--muted))]"
                                        >
                                            <div className="font-medium">{product.name}</div>
                                            <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                                {product.barcode} • {product.unit}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Type */}
                <div>
                    <label className="block text-sm font-medium mb-1">Adjustment Type</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="input w-full"
                    >
                        <option value="DAMAGE">Damage (Loss)</option>
                        <option value="EXPIRY">Expiry (Loss)</option>
                        <option value="SELF_USE">Self Use (Loss)</option>
                        <option value="RETURN">Return (Gain)</option>
                        <option value="ADJUSTMENT">Manual Adjustment (+/-)</option>
                    </select>
                </div>

                {/* Quantity */}
                <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter quantity"
                        required
                        className="w-full"
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                        {['DAMAGE', 'EXPIRY', 'SELF_USE'].includes(type)
                            ? 'Enter positive amount to remove from stock.'
                            : 'Enter positive to add, negative to remove.'}
                    </p>
                </div>

                {/* Notes */}
                <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="input w-full h-24 resize-none"
                        placeholder="Reason for adjustment..."
                    />
                </div>

                <div className="flex gap-4 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={submitting || !selectedProduct || !quantity}
                        className="flex-1"
                    >
                        {submitting ? 'Saving...' : 'Save Adjustment'}
                    </Button>
                </div>

            </form>
        </div>
    )
}
