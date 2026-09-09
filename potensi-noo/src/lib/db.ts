import type { VisitRecord } from '../types'
import type { BuiltData } from './pipeline'

const DB_NAME = 'potensi-noo'
const DB_VERSION = 1
const DATASET_STORE = 'dataset'
const VISIT_STORE = 'visits'
const DATASET_KEY = 'current'

let handle: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (handle) return handle
  handle = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DATASET_STORE)) db.createObjectStore(DATASET_STORE)
      if (!db.objectStoreNames.contains(VISIT_STORE)) db.createObjectStore(VISIT_STORE, { keyPath: 'outletCode' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB tidak bisa dibuka'))
  })
  return handle
}

function run<T>(store: string, mode: IDBTransactionMode, body: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        const request = body(transaction.objectStore(store))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Penyimpanan gagal'))
      }),
  )
}

export function saveDataset(data: BuiltData): Promise<unknown> {
  return run(DATASET_STORE, 'readwrite', (store) => store.put(data, DATASET_KEY))
}

export function loadDataset(): Promise<BuiltData | null> {
  return run<BuiltData | undefined>(DATASET_STORE, 'readonly', (store) => store.get(DATASET_KEY))
    .then((value) => value ?? null)
    .catch(() => null)
}

export function clearDataset(): Promise<unknown> {
  return run(DATASET_STORE, 'readwrite', (store) => store.delete(DATASET_KEY))
}

export function loadVisits(): Promise<VisitRecord[]> {
  return run<VisitRecord[]>(VISIT_STORE, 'readonly', (store) => store.getAll()).catch(() => [])
}

export function putVisit(record: VisitRecord): Promise<unknown> {
  return run(VISIT_STORE, 'readwrite', (store) => store.put(record))
}

export function deleteVisit(outletCode: number): Promise<unknown> {
  return run(VISIT_STORE, 'readwrite', (store) => store.delete(outletCode))
}

export function clearVisits(): Promise<unknown> {
  return run(VISIT_STORE, 'readwrite', (store) => store.clear())
}
