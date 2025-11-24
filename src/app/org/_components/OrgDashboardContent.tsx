'use client'

import { useLanguage } from '@/contexts/LanguageContext'

interface OrgDashboardContentProps {
  shopsCount: number
  usersInOrg: number
  productsCount: number
  invoicesTodayCount: number
  outstandingUdhaar: number
}

export function OrgDashboardContent({
  shopsCount,
  usersInOrg,
  productsCount,
  invoicesTodayCount,
  outstandingUdhaar,
}: OrgDashboardContentProps) {
  const { t } = useLanguage()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{t('organization_dashboard')}</h1>
      <p className="text-[hsl(var(--muted-foreground))] mb-6">{t('consolidated_view')}</p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('stores')}</div>
            <div className="text-2xl font-semibold">{shopsCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('users')}</div>
            <div className="text-2xl font-semibold">{usersInOrg}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('products')}</div>
            <div className="text-2xl font-semibold">{productsCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="text-sm text-[hsl(var(--muted-foreground))]">{t('invoices_today')}</div>
            <div className="text-2xl font-semibold">{invoicesTodayCount}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="font-semibold text-lg mb-2">{t('outstanding_udhaar')}</h2>
          <div className="text-2xl font-semibold">
            {Number(outstandingUdhaar).toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  )
}


