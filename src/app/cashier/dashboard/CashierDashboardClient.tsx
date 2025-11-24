'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import EndShiftButton from './EndShiftButton'

interface DashboardProps {
    shopName?: string
    summary: {
        totalSales: number
        cashSales: number
        cardSales: number
        udhaarSales: number
        invoiceCount: number
    }
    lowStockProducts: Array<{
        id: string
        name: string
        reorderLevel: number | null
    }>
}

export default function CashierDashboardClient({ shopName, summary, lowStockProducts }: DashboardProps) {
    const { t, language } = useLanguage()

    return (
        <div dir={language === 'ur' ? 'rtl' : 'ltr'}>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold mb-2">{t('dashboard')}</h1>
                    <p className="text-[hsl(var(--muted-foreground))]">
                        {shopName}
                    </p>
                </div>
                <EndShiftButton summary={summary} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="card">
                    <div className="card-body">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('today_sales')}</div>
                        <div className="text-2xl font-semibold">Rs.{summary.totalSales.toFixed(2)}</div>
                        <div className="text-xs text-[hsl(var(--muted-foreground))]">{summary.invoiceCount} invoices</div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('cash_in_hand')}</div>
                        <div className="text-2xl font-semibold text-green-600">Rs.{summary.cashSales.toFixed(2)}</div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('card_sales')}</div>
                        <div className="text-2xl font-semibold text-blue-600">Rs.{summary.cardSales.toFixed(2)}</div>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('udhaar')}</div>
                        <div className="text-2xl font-semibold text-orange-600">Rs.{summary.udhaarSales.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {lowStockProducts.length > 0 && (
                <div className="card mb-6">
                    <div className="card-body">
                        <h2 className="font-semibold text-lg mb-4">{t('low_stock')}</h2>
                        <div className="space-y-2">
                            {lowStockProducts.map((product) => (
                                <div
                                    key={product.id}
                                    className="flex justify-between items-center p-2 bg-[hsl(var(--muted))] rounded"
                                >
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                        Reorder at: {product.reorderLevel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-6">
                <a
                    href="/pos"
                    className="block w-full text-center px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-lg transition-colors shadow-lg"
                >
                    {t('open_pos')}
                </a>
            </div>
        </div>
    )
}
