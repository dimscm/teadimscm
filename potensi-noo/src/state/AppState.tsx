import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EMPTY_FILTERS, type ColourMode, type Dataset, type Filters, type ReferencePoint, type SortKey, type VisitRecord } from '../types'
import { mappedDivisions, materialise } from '../lib/dataset'
import { runFilter, type FilterResult } from '../lib/filter'
import * as db from '../lib/db'
import { SyncQueue } from '../lib/sync'
import type { BuildRequest, BuildResponse } from '../worker/build.worker'

type Status = 'starting' | 'empty' | 'building' | 'ready' | 'error'

interface Preferences {
  radiusM: number
  groupByStore: boolean
  includeUnmapped: boolean
  highlightGapFor: Filters['highlightGapFor']
  colourMode: ColourMode
  /** Start plain: one question, one answer. Advanced controls stay hidden. */
  simpleMode: boolean
  /** Side panels can be folded away so the map gets the whole window. */
  showSidebar: boolean
  showNearby: boolean
  sortKey: SortKey
  sortDesc: boolean
  salesName: string
}

const DEFAULT_PREFERENCES: Preferences = {
  radiusM: 60,
  groupByStore: true,
  includeUnmapped: false,
  highlightGapFor: ['M3'],
  colourMode: 'divisi',
  simpleMode: true,
  showSidebar: true,
  showNearby: true,
  sortKey: 'distance',
  sortDesc: false,
  salesName: '',
}

const PREF_KEY = 'potensi-noo:prefs'

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return DEFAULT_PREFERENCES
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

interface AppStateValue {
  status: Status
  data: Dataset | null
  error: string | null
  progress: { step: string; ratio: number } | null
  result: FilterResult
  filters: Filters
  setFilters: (update: Partial<Filters>) => void
  resetFilters: () => void
  preferences: Preferences
  setPreferences: (update: Partial<Preferences>) => void
  reference: ReferencePoint | null
  setReference: (point: ReferencePoint | null) => void
  selected: number | null
  setSelected: (row: number | null) => void
  visits: Map<number, VisitRecord>
  saveVisit: (outletCode: number, patch: Partial<VisitRecord>) => void
  removeVisit: (outletCode: number) => void
  ingest: (file: File) => void
  clearData: () => void
  /** Bumped when something asks the map to frame the current result. */
  fitToken: number
  requestFit: () => void
}

const AppStateContext = createContext<AppStateValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('starting')
  const [data, setData] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ step: string; ratio: number } | null>(null)
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS)
  const [preferences, setPreferencesState] = useState<Preferences>(loadPreferences)
  const [reference, setReference] = useState<ReferencePoint | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [visits, setVisits] = useState<Map<number, VisitRecord>>(new Map())
  const [fitToken, setFitToken] = useState(0)
  const worker = useRef<Worker | null>(null)
  const sync = useRef<SyncQueue | null>(null)
  if (sync.current === null && typeof window !== 'undefined') sync.current = new SyncQueue()

  // Narrowing filters never survive a reload — coming back to a map that
  // silently hides 56,000 outlets is how you lose trust in it.
  useEffect(() => {
    setFiltersState((current) => ({
      ...current,
      groupByStore: preferences.groupByStore,
      includeUnmapped: preferences.includeUnmapped,
      highlightGapFor: preferences.highlightGapFor,
    }))
  }, [preferences.groupByStore, preferences.includeUnmapped, preferences.highlightGapFor])

  useEffect(() => {
    let alive = true
    Promise.all([db.loadDataset(), db.loadVisits()]).then(([built, records]) => {
      if (!alive) return
      setVisits(new Map(records.map((record) => [record.outletCode, record])))
      if (built) {
        const dataset = materialise(built)
        const mappable = mappedDivisions(dataset)
        setPreferencesState((current) => ({
          ...current,
          highlightGapFor: current.highlightGapFor.filter((division) => mappable.includes(division)),
        }))
        setData(dataset)
        setStatus('ready')
      } else {
        setStatus('empty')
      }
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(preferences))
    } catch {
      // Private-mode browsers refuse storage; preferences just stop persisting.
    }
  }, [preferences])

  const setFilters = useCallback((update: Partial<Filters>) => {
    setFiltersState((current) => ({ ...current, ...update }))
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState((current) => ({
      ...EMPTY_FILTERS,
      groupByStore: current.groupByStore,
      includeUnmapped: current.includeUnmapped,
      highlightGapFor: current.highlightGapFor,
    }))
  }, [])

  const setPreferences = useCallback((update: Partial<Preferences>) => {
    setPreferencesState((current) => ({ ...current, ...update }))
  }, [])

  const ingest = useCallback((file: File) => {
    setStatus('building')
    setError(null)
    setProgress({ step: 'Membaca file', ratio: 0.01 })
    setSelected(null)

    worker.current?.terminate()
    const instance = new Worker(new URL('../worker/build.worker.ts', import.meta.url), { type: 'module' })
    worker.current = instance

    instance.onmessage = (event: MessageEvent<BuildResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        setProgress({ step: message.step, ratio: message.ratio })
        return
      }
      if (message.type === 'error') {
        setError(message.message)
        setStatus('error')
        setProgress(null)
        instance.terminate()
        worker.current = null
        return
      }
      const dataset = materialise(message.data)
      // Marking a division the new file has no coordinates for would flag every
      // shop as an opportunity — a confident answer built on nothing.
      const mappable = mappedDivisions(dataset)
      setPreferencesState((current) => ({
        ...current,
        highlightGapFor: current.highlightGapFor.filter((division) => mappable.includes(division)),
      }))
      setData(dataset)
      setStatus('ready')
      setProgress(null)
      db.saveDataset(message.data).catch(() => {
        // Out of quota: the dataset still works, it just will not survive a reload.
      })
      instance.terminate()
      worker.current = null
    }
    instance.onerror = (event) => {
      setError(event.message || 'Gagal memproses file.')
      setStatus('error')
      setProgress(null)
    }

    file
      .arrayBuffer()
      .then((buffer) => {
        const request: BuildRequest = { buffer, name: file.name }
        instance.postMessage(request, [buffer])
      })
      .catch(() => {
        setError('File tidak bisa dibaca.')
        setStatus('error')
      })
  }, [])

  const clearData = useCallback(() => {
    setData(null)
    setStatus('empty')
    setSelected(null)
    setReference(null)
    setFiltersState(EMPTY_FILTERS)
    db.clearDataset().catch(() => {})
  }, [])

  const saveVisit = useCallback(
    (outletCode: number, patch: Partial<VisitRecord>) => {
      setVisits((current) => {
        const next = new Map(current)
        const existing = next.get(outletCode)
        const record: VisitRecord = {
          outletCode,
          status: 'dikunjungi',
          supply: '',
          note: '',
          by: preferences.salesName,
          ...existing,
          ...patch,
          visitedAt: patch.visitedAt ?? new Date().toISOString(),
        }
        next.set(outletCode, record)
        db.putVisit(record).catch(() => {})
        sync.current?.add(record)
        return next
      })
    },
    [preferences.salesName],
  )

  const requestFit = useCallback(() => setFitToken((value) => value + 1), [])

  const removeVisit = useCallback((outletCode: number) => {
    setVisits((current) => {
      const next = new Map(current)
      next.delete(outletCode)
      db.deleteVisit(outletCode).catch(() => {})
      return next
    })
  }, [])

  const result = useMemo(
    () => runFilter(data, filters, preferences.radiusM, reference, preferences.sortKey, preferences.sortDesc, visits),
    [data, filters, preferences.radiusM, preferences.sortKey, preferences.sortDesc, reference, visits],
  )

  const value = useMemo<AppStateValue>(
    () => ({
      status,
      data,
      error,
      progress,
      result,
      filters,
      setFilters,
      resetFilters,
      preferences,
      setPreferences,
      reference,
      setReference,
      selected,
      setSelected,
      visits,
      saveVisit,
      removeVisit,
      ingest,
      clearData,
      fitToken,
      requestFit,
    }),
    [
      status,
      data,
      error,
      progress,
      result,
      filters,
      setFilters,
      resetFilters,
      preferences,
      setPreferences,
      reference,
      selected,
      visits,
      saveVisit,
      removeVisit,
      ingest,
      clearData,
      fitToken,
      requestFit,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useApp(): AppStateValue {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useApp harus dipakai di dalam AppStateProvider')
  return value
}
