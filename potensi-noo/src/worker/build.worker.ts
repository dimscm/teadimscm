/// <reference lib="webworker" />
import { buildDataset } from '../lib/pipeline'
import type { BuiltData } from '../lib/pipeline'

export interface BuildRequest {
  buffer: ArrayBuffer
  name: string
}

export type BuildResponse =
  | { type: 'progress'; step: string; ratio: number }
  | { type: 'done'; data: BuiltData }
  | { type: 'error'; message: string }

self.onmessage = (event: MessageEvent<BuildRequest>) => {
  const post = (message: BuildResponse) => self.postMessage(message)
  try {
    const data = buildDataset(event.data.buffer, event.data.name, (progress) =>
      post({ type: 'progress', step: progress.step, ratio: progress.ratio }),
    )
    post({ type: 'done', data })
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
