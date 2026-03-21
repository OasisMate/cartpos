type SyncTask = {
  name: string
  run: (shopId: string) => Promise<unknown>
}

const tasks: SyncTask[] = []

/** Serializes sync runs so "Sync now" waits for an in-flight background pass instead of being dropped */
let syncChain: Promise<void> = Promise.resolve()

export function registerSyncTask(task: SyncTask) {
  if (tasks.find((t) => t.name === task.name)) return
  tasks.push(task)
}

export async function runAllSyncTasks(shopId: string): Promise<void> {
  if (!shopId) return

  const run = async () => {
    await Promise.all(tasks.map((t) => t.run(shopId)))
  }

  const next = syncChain.then(run, run)
  syncChain = next.catch(() => {})
  await next
}

