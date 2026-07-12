export type SyncRunResult = { synced: number; failed: number; firstError?: string }

type SyncTask = {
  name: string
  run: (shopId: string) => Promise<SyncRunResult>
}

const tasks: SyncTask[] = []

/** Serializes sync runs so "Sync now" waits for an in-flight background pass instead of being dropped */
let syncChain: Promise<void> = Promise.resolve()

export function registerSyncTask(task: SyncTask) {
  if (tasks.find((t) => t.name === task.name)) return
  tasks.push(task)
}

export async function runAllSyncTasks(shopId: string): Promise<SyncRunResult> {
  if (!shopId) return { synced: 0, failed: 0 }

  const total: SyncRunResult = { synced: 0, failed: 0 }

  const collect = (r: SyncRunResult | null | undefined) => {
    if (!r) return
    total.synced += r.synced || 0
    total.failed += r.failed || 0
    if (!total.firstError && r.firstError) total.firstError = r.firstError
  }

  const run = async () => {
    // Customers first: offline sales/udhaar payments can reference a customer created
    // on this device, so it must exist on the server before they sync.
    const customerTasks = tasks.filter((t) => t.name === 'customers')
    const otherTasks = tasks.filter((t) => t.name !== 'customers')
    for (const t of customerTasks) {
      collect(await t.run(shopId))
    }
    const results = await Promise.all(otherTasks.map((t) => t.run(shopId)))
    results.forEach(collect)
  }

  const next = syncChain.then(run, run)
  syncChain = next.catch(() => {})
  await next
  return total
}
