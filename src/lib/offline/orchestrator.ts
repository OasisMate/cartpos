type SyncTask = {
  name: string
  run: (shopId: string) => Promise<unknown>
}

const tasks: SyncTask[] = []
let isRunning = false

export function registerSyncTask(task: SyncTask) {
  if (tasks.find((t) => t.name === task.name)) return
  tasks.push(task)
}

export async function runAllSyncTasks(shopId: string) {
  if (!shopId) return
  if (isRunning) return
  isRunning = true
  try {
    await Promise.all(tasks.map((t) => t.run(shopId)))
  } finally {
    isRunning = false
  }
}

