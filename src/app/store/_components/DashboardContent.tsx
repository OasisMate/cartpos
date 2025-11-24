'use client'

import { useLanguage } from '@/contexts/LanguageContext'

interface DashboardContentProps {
  shopName: string
  invoicesToday: number
  paymentsToday: number
  udhaarCreatedToday: number
  lowStockCount: number
}

export function DashboardContent({
  shopName,
  invoicesToday,
  paymentsToday,
  udhaarCreatedToday,
  lowStockCount,
}: DashboardContentProps) {
  const { t } = useLanguage()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{shopName} — {t('dashboard')}</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-6">{t('todays_snapshot')}</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('invoices_today')}</div>
            <div className="text-2xl font-semibold">{invoicesToday}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('payments_today')}</div>
            <div className="text-2xl font-semibold">
              {Number(paymentsToday).toFixed(2)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('udhaar_today')}</div>
            <div className="text-2xl font-semibold">
              {Number(udhaarCreatedToday).toFixed(2)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('low_stock_items')}</div>
            <div className="text-2xl font-semibold">{lowStockCount}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href="/store/pos">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('quick_action')}</div>
            <div className="text-lg font-semibold">{t('open_pos')}</div>
          </div>
        </a>
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href="/store/products">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('quick_action')}</div>
            <div className="text-lg font-semibold">{t('add_product')}</div>
          </div>
        </a>
        <a className="card hover:bg-[hsl(var(--muted))] transition-colors" href="/store/customers">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('quick_action')}</div>
            <div className="text-lg font-semibold">{t('record_udhaar_payment')}</div>
          </div>
        </a>
      </div>
    </div>
  )
}


