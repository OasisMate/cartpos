'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { getPendingExpenses, CachedExpense } from '@/lib/offline/indexedDb'
import Button from '@/components/ui/Button'

export default function ExpensesPage() {
    const { user } = useAuth()
    const [pendingExpenses, setPendingExpenses] = useState<CachedExpense[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadPending() {
            if (!user?.currentShopId) return
            try {
                const pending = await getPendingExpenses(user.currentShopId)
                setPendingExpenses(pending)
            } catch (err) {
                console.error('Failed to load pending expenses:', err)
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
                <h1 className="text-2xl font-bold">Expenses</h1>
                <Link href="/backoffice/expenses/new">
                    <Button>New Expense</Button>
                </Link>
            </div>

            <div className="bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] p-4 mb-6">
                <h2 className="text-lg font-semibold mb-4">Pending Sync ({pendingExpenses.length})</h2>
                {loading ? (
                    <div>Loading...</div>
                ) : pendingExpenses.length === 0 ? (
                    <div className="text-[hsl(var(--muted-foreground))]">No pending expenses</div>
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
                                    <div className="font-semibold">Rs.{exp.amount.toFixed(2)}</div>
                                    <div className="text-sm text-[hsl(var(--muted-foreground))]">
                                        {new Date(exp.date).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] p-4">
                <h2 className="text-lg font-semibold mb-4">Recent Expenses</h2>
                <p className="text-[hsl(var(--muted-foreground))]">
                    Server-side list not implemented yet. Only pending offline expenses are shown above.
                </p>
            </div>
        </div>
    )
}
