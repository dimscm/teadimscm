import type { VisitRecord } from '../types'

const QUEUE_KEY = 'potensi-noo:outbox'
const ENDPOINT = 'api/visits'

/**
 * Best-effort mirror of the survey notes to a server.
 *
 * The app is complete without it: every note is already saved on the device and
 * can be exported to CSV. When the site is deployed with a database bound, this
 * pushes the same notes there so the office does not have to collect files. If
 * the endpoint is missing (503/404), the queue switches itself off and stops
 * bothering the user.
 */
export class SyncQueue {
  private queue = new Map<number, VisitRecord>()
  private disabled = false
  private flushing = false

  constructor() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY)
      if (raw) {
        for (const record of JSON.parse(raw) as VisitRecord[]) this.queue.set(record.outletCode, record)
      }
    } catch {
      // A corrupt outbox is not worth a crash.
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => void this.flush())
    }
  }

  get pending(): number {
    return this.queue.size
  }

  get isDisabled(): boolean {
    return this.disabled
  }

  add(record: VisitRecord): void {
    if (this.disabled) return
    this.queue.set(record.outletCode, record)
    this.persist()
    void this.flush()
  }

  private persist(): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify([...this.queue.values()]))
    } catch {
      // Storage full: the records stay in memory for this session.
    }
  }

  async flush(): Promise<void> {
    if (this.disabled || this.flushing || this.queue.size === 0) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    this.flushing = true
    const batch = [...this.queue.values()].slice(0, 200)
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ records: batch }),
      })
      if (response.status === 404 || response.status === 405 || response.status === 503) {
        this.disabled = true
      } else if (response.ok) {
        for (const record of batch) this.queue.delete(record.outletCode)
        this.persist()
      }
    } catch {
      // Offline or blocked: keep the queue and try again later.
    } finally {
      this.flushing = false
    }
  }
}
