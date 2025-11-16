type SyncResult = { synced: number; failed: number }

interface SyncConfig<LocalRecord, Payload> {
  shopId: string
  getPending: (shopId: string) => Promise<LocalRecord[]>
  markSynced: (id: string) => Promise<void>
  markError: (id: string, error: string) => Promise<void>
  toPayload: (record: LocalRecord) => Payload
  endpoint: string
}

export async function syncPendingBatch<LocalRecord, Payload>(
  config: SyncConfig<LocalRecord, Payload>
): Promise<SyncResult> {
  const { shopId, getPending, markSynced, markError, toPayload, endpoint } = config
  const pending = await getPending(shopId)
  if (pending.length === 0) {
    return { synced: 0, failed: 0 }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sales: pending.map(toPayload),
      }),
    })

    if (!response.ok) {
      throw new Error(`Failed to sync batch: ${response.status}`)
    }

    const data = await response.json()
    for (const rec of pending as any[]) {
      const error = data.errors?.find((e: any) => e.id === rec.id)
      if (!error) {
        await markSynced(rec.id)
      } else {
        await markError(rec.id, error.error)
      }
    }

    return {
      synced: data.synced || 0,
      failed: data.errors?.length || 0,
    }
  } catch (error: any) {
    // Mark all as failed for visibility
    for (const rec of pending as any[]) {
      await markError(rec.id, error.message || 'Batch sync failed')
    }
    return { synced: 0, failed: pending.length }
  }
}

