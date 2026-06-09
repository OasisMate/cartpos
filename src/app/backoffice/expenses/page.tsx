'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getPendingExpenses, CachedExpense } from '@/lib/offline/indexedDb'
import Button from '@/components/ui/Button'
import { formatCurrency } from '@/lib/utils/money'

interface RecordedExpense {
    id: string
    category: string
    amount: number
    description: string | null
    date: string
    userName: string | null
}

export default function ExpensesPage() {
    const { user } = useAuth()
    const [pendingExpenses, setPendingExpenses] = useState<CachedExpense[]>([])
    const [recorded, setRecorded] = useState<RecordedExpense[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingRecorded, setLoadingRecorded] = useState(true)

    const loadPending = useCallback(async () => {
        if (!user?.currentShopId) return
        try {
            const pending = await getPendingExpenses(user.currentShopId)
            setPendingExpenses(pending)
        } catch (err) {
            console.error('Failed to load pending expenses:', err)
        } finally {
            setLoading(false)
        }
    }, [user?.currentShopId])

    const loadRecorded = useCallback(async () => {
        if (!user?.currentShopId) return
        try {
            const res = await fetch('/api/expenses')
            if (res.ok) {
                const data = await res.json()
                setRecorded(data.expenses || [])
            }
        } catch (err) {
            console.error('Failed to load recorded expenses:', err)
        } finally {
            setLoadingRecorded(false)
        }
    }, [user?.currentShopId])

    useEffect(() => {
        loadPending()
        loadRecorded()
    }, [loadPending, loadRecorded])

    if (!user?.currentShopId) return null

    const recordedTotal = recorded.reduce((s, e) => s + e.amount, 0)

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Expenses</h1>
                <Link href="/store/expenses/new">
                    <Button>New Expense</Button>
                </Link>
            </div>

            {/* Pending sync — only shown when there is something waiting to upload. */}
            {(loading || pendingExpenses.length > 0) && (
                <div className="bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] p-4 mb-6">
                    <h2 className="text-lg font-semibold mb-4">Pending Sync ({pendingExpenses.length})</h2>
                    {loading ? (
                        <div>Loading...</div>
                    ) : (
                        <div className="space-y-2">
                            {pendingExpenses.map((exp) => (
                                <div key={exp.id} className="flex justify-between items-center p-3 bg-[hsl(var(--muted))] rounded">
                                    <div>
                                        <div className="font-medium">{exp.category}</div>
                                        <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {exp.description || 'No description'}
                                        </div>
                                        {exp.syncError && (
                                            <div className="text-xs text-red-500 mt-1">Error: {exp.syncError}</div>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold">{formatCurrency(exp.amount)}</div>
                                        <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                            {new Date(exp.date).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Recorded expenses — synced to the server. */}
            <div className="bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] p-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Recorded Expenses</h2>
                    {recorded.length > 0 && (
                        <span className="text-sm text-[hsl(var(--muted-foreground))]">
                            Total: <span className="font-semibold text-[hsl(var(--foreground))]">{formatCurrency(recordedTotal)}</span>
                        </span>
                    )}
                </div>
                {loadingRecorded ? (
                    <div>Loading...</div>
                ) : recorded.length === 0 ? (
                    <div className="text-[hsl(var(--muted-foreground))]">No expenses recorded yet.</div>
                ) : (
                    <div className="space-y-2">
                        {recorded.map((exp) => (
                            <div key={exp.id} className="flex justify-between items-center p-3 bg-[hsl(var(--muted))] rounded">
                                <div>
                                    <div className="font-medium">{exp.category}</div>
                                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                        {exp.description || 'No description'}
                                        {exp.userName ? ` • ${exp.userName}` : ''}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold">{formatCurrency(exp.amount)}</div>
                                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                        {new Date(exp.date).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
