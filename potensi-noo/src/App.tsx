import { useEffect, useState } from 'react'
import { useApp } from './state/AppState'
import MapView from './components/MapView'
import MapLegend from './components/MapLegend'
import NearbyPanel from './components/NearbyPanel'
import ListView from './components/ListView'
import Dashboard from './components/Dashboard'
import FilterPanel from './components/FilterPanel'
import DetailDrawer from './components/DetailDrawer'
import SettingsSheet from './components/SettingsSheet'
import UploadScreen from './components/UploadScreen'
import { formatNumber } from './lib/format'

type Tab = 'peta' | 'daftar' | 'ringkasan'

export default function App() {
  const { status, data, filters, setFilters, resetFilters, preferences, result, setSelected } = useApp()
  const [tab, setTab] = useState<Tab>('peta')
  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [replacing, setReplacing] = useState(false)

  useEffect(() => {
    if (status === 'ready') setReplacing(false)
  }, [status])

  if (status === 'starting') {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">Memuat…</div>
    )
  }

  if (status !== 'ready' || replacing) {
    return <UploadScreen onCancel={data && status === 'ready' ? () => setReplacing(false) : undefined} />
  }

  const narrowing =
    filters.query.trim().length > 0 ||
    filters.divisions.length > 0 ||
    filters.channels.length > 0 ||
    filters.kecamatan.length > 0 ||
    filters.kelurahan.length > 0 ||
    filters.minOmzet > 0 ||
    filters.onlyGap ||
    filters.onlyVisited ||
    filters.onlyUnvisited

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <header className="z-[1100] shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="min-w-0 flex-1">
            <input
              value={filters.query}
              onChange={(event) => setFilters({ query: event.target.value })}
              placeholder="Cari nama toko, kode, alamat…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-slate-400 focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className={`flex h-10 items-center gap-1 rounded-xl border px-3 text-sm font-semibold transition ${
              narrowing ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            Filter
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Pengaturan"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
          >
            ⚙
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 pb-2">
          {(['peta', 'daftar', 'ringkasan'] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                tab === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {value}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-slate-500">
            {formatNumber(result.count)} titik
            {result.markedCount > 0 && (
              <span className="text-amber-700"> · {formatNumber(result.markedCount)} peluang</span>
            )}
          </span>
        </div>

        {narrowing && (
          <div className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-3 py-1.5">
            <span className="text-[11px] text-amber-900">
              Filter aktif — sebagian outlet disembunyikan
              {preferences.highlightGapFor && filters.onlyGap ? ` (hanya peluang ${preferences.highlightGapFor})` : ''}.
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto rounded-md bg-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900"
            >
              Reset
            </button>
          </div>
        )}
      </header>

      <main className="relative min-h-0 flex-1">
        {tab === 'peta' && (
          <>
            <MapView />
            <div className="pointer-events-none absolute top-3 left-3 z-[900]">
              <MapLegend />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[900] flex justify-center sm:right-3 sm:left-auto sm:bottom-3 sm:justify-end">
              <NearbyPanel onOpenDetail={setSelected} />
            </div>
          </>
        )}
        {tab === 'daftar' && <ListView />}
        {tab === 'ringkasan' && <Dashboard />}
      </main>

      <FilterPanel open={filterOpen} onClose={() => setFilterOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onReplaceData={() => setReplacing(true)} />
      <DetailDrawer />
    </div>
  )
}
