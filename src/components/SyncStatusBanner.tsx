'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getPendingSyncSummary, formatPendingSyncLabel } from '@/lib/offline/pendingSyncSummary'
import { runAllSyncTasks } from '@/lib/offline/orchestrator'
import { buildSyncDiagnostics } from '@/lib/offline/diagnostics'
import { useAuth } from '@/contexts/AuthContext'
import { CloudUpload, Loader2 } from 'lucide-react'

type Props = {
  shopId: string | undefined
}

export function SyncStatusBanner({ shopId }: Props) {
  const isOnline = useOnlineStatus()
  const { user } = useAuth()
  const [summary, setSummary] = useState<{
    total: number
    sales: number
    purchases: number
    customers: number
    udhaarPayments: number
    expenses: number
    stockAdjustments: number
    firstError?: string
  }>({ total: 0, sales: 0, purchases: 0, customers: 0, udhaarPayments: 0, expenses: 0, stockAdjustments: 0 })
  const [syncing, setSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)
  const [reportMsg, setReportMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!shopId) {
      setSummary({ total: 0, sales: 0, purchases: 0, customers: 0, udhaarPayments: 0, expenses: 0, stockAdjustments: 0 })
      return
    }
    try {
      const next = await getPendingSyncSummary(shopId)
      setSummary(next)
      if (next.total === 0) setLastError(null)
    } catch {
      /* IndexedDB unavailable - ignore */
    }
  }, [shopId])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 8000)
    return () => window.clearInterval(id)
  }, [refresh])

  useEffect(() => {
    const onOnline = () => void refresh()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refresh])

  if (!shopId || summary.total === 0) {
    return null
  }

  const detail = formatPendingSyncLabel(summary)
  const topClass = isOnline ? 'top-0' : 'top-[42px]'

  async function handleSyncNow() {
    if (!shopId || !isOnline || syncing) return
    setSyncing(true)
    setLastError(null)
    try {
      const result = await runAllSyncTasks(shopId)
      await refresh()
      if (result.failed > 0) {
        setLastError(
          result.firstError
            ? `${result.failed} could not sync: ${result.firstError}`
            : `${result.failed} could not sync`
        )
      }
    } catch (e: unknown) {
      setLastError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleReport() {
    if (!shopId || reporting) return
    setReporting(true)
    setReportMsg(null)
    try {
      const bundle = await buildSyncDiagnostics(shopId, { orgId: user?.currentOrgId ?? undefined, userId: user?.id })
      try {
        const res = await fetch('/api/sync-error-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: bundle }),
        })
        if (!res.ok) throw new Error(String(res.status))
        setReportMsg('Problem reported, we will look into it.')
      } catch {
        // Offline / upload failed: save a file the shopkeeper can send on WhatsApp.
        const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `cartpos-sync-report-${bundle.generatedAt}.json`
        document.body.appendChild(a); a.click(); a.remove()
        URL.revokeObjectURL(url)
        setReportMsg('Could not reach the server. A file was saved - please send it to us on WhatsApp.')
      }
    } finally {
      setReporting(false)
    }
  }

  return (
    <div
      className={`fixed ${topClass} left-0 right-0 z-[45] border-b border-amber-200 bg-amber-50 text-amber-950 shadow-sm`}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-2 text-sm">
          <CloudUpload className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <div className="min-w-0">
            <span className="font-medium">
              {summary.total} item{summary.total === 1 ? '' : 's'} waiting to sync
            </span>
            {detail ? (
              <span className="block text-amber-900/80 sm:inline sm:before:content-['-_']">{detail}</span>
            ) : null}
            {!isOnline ? (
              <span className="mt-0.5 block text-xs text-amber-800/90">Reconnect to upload to the server.</span>
            ) : null}
            {lastError ? (
              <span className="mt-0.5 block text-xs text-red-700">{lastError}</span>
            ) : summary.firstError ? (
              <span className="mt-0.5 block text-xs text-red-700">Last error: {summary.firstError}</span>
            ) : null}
            {reportMsg ? (
              <span className="mt-0.5 block text-xs text-emerald-700">{reportMsg}</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="btn btn-primary h-9 px-4 text-sm disabled:opacity-50"
            disabled={!isOnline || syncing}
            onClick={() => void handleSyncNow()}
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                Syncing…
              </>
            ) : (
              'Sync now'
            )}
          </button>
          {(lastError || summary.firstError) ? (
            <button
              type="button"
              className="btn btn-ghost h-9 px-3 text-sm disabled:opacity-50"
              disabled={reporting}
              onClick={() => void handleReport()}
            >
              {reporting ? 'Reporting...' : 'Report problem'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
