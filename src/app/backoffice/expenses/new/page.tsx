'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { saveExpense } from '@/lib/offline/expenses'
import { cuid } from '@/lib/utils/cuid'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useToast } from '@/components/ui/ToastProvider'

export default function NewExpensePage() {
    const { user } = useAuth()
    const router = useRouter()
    const { show } = useToast()
    const isOnline = useOnlineStatus()

    const [category, setCategory] = useState('Tea/Refreshments')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!user?.currentShopId || !amount) return

        setSubmitting(true)
        try {
            const expense = {
                id: cuid(),
                shopId: user.currentShopId,
                category,
                amount: parseFloat(amount),
                description,
                date: new Date(date).getTime()
            }

            await saveExpense(expense, isOnline)

            show({ message: 'Expense saved', variant: 'success' })
            router.push('/backoffice/expenses')
        } catch (err) {
            console.error('Error saving expense:', err)
            show({ message: 'Failed to save expense', variant: 'destructive' })
        } finally {
            setSubmitting(false)
        }
    }

    if (!user?.currentShopId) return null

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">New Expense</h1>

            <form onSubmit={handleSubmit} className="space-y-6 bg-[hsl(var(--card))] p-6 rounded-lg border border-[hsl(var(--border))]">

                {/* Category */}
                <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="input w-full"
                    >
                        <option value="Tea/Refreshments">Tea / Refreshments</option>
                        <option value="Electricity">Electricity</option>
                        <option value="Rent">Rent</option>
                        <option value="Salary">Salary</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                {/* Amount */}
                <div>
                    <label className="block text-sm font-medium mb-1">Amount</label>
                    <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        required
                        className="w-full"
                        step="0.01"
                    />
                </div>

                {/* Date */}
                <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className="w-full"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="input w-full h-24 resize-none"
                        placeholder="Details..."
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
                        disabled={submitting || !amount}
                        className="flex-1"
                    >
                        {submitting ? 'Saving...' : 'Save Expense'}
                    </Button>
                </div>

            </form>
        </div>
    )
}
