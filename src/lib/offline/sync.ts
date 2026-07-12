export type SyncResult = { synced: number; failed: number; firstError?: string }
import { withBackoff } from './backoff'

interface SyncConfig<LocalRecord, Payload> {
  shopId: string
  getPending: (shopId: string) => Promise<LocalRecord[]>
  markSynced: (id: string) => Promise<void>
  markError: (id: string, error: string) => Promise<void>
  toPayload: (record: LocalRecord) => Payload
  endpoint: string
}

/** Keep each request small so serverless functions finish well within their time limit. */
const CHUNK_SIZE = 20

const lastAttemptStatuses: Record<string, number> = {}
export function getLastAttemptStatuses(): Record<string, number> {
  return { ...lastAttemptStatuses }
}

export async function syncPendingBatch<LocalRecord, Payload>(
  config: SyncConfig<LocalRecord, Payload>
): Promise<SyncResult> {
  const { shopId, getPending, markSynced, markError, toPayload, endpoint } = config
  const pending = await getPending(shopId)
  if (pending.length === 0) {
    return { synced: 0, failed: 0 }
  }

  let synced = 0
  let failed = 0
  let firstError: string | undefined

  for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
    const chunk = pending.slice(i, i + CHUNK_SIZE)
    try {
      const data = await withBackoff(async () => {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sales: chunk.map(toPayload),
          }),
        }).catch((e) => {
          lastAttemptStatuses[endpoint] = 0
          throw e
        })
        lastAttemptStatuses[endpoint] = response.status
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? 'Session expired, please sign in again'
              : `Failed to sync batch: ${response.status}`
          )
        }
        return await response.json()
      })
      const skippedSet = new Set<string>(data.skippedIds || [])
      for (const rec of chunk as any[]) {
        const error = data.errors?.find((e: any) => e.id === rec.id)
        if (!error || skippedSet.has(rec.id)) {
          await markSynced(rec.id)
          synced++
        } else {
          await markError(rec.id, error.error)
          failed++
          if (!firstError) firstError = error.error
        }
      }
    } catch (error: any) {
      // Records stay PENDING; the error is stored for visibility and retried next pass
      const message = error.message || 'Batch sync failed'
      for (const rec of chunk as any[]) {
        await markError(rec.id, message)
      }
      failed += chunk.length
      if (!firstError) firstError = message
    }
  }

  return { synced, failed, firstError }
}
