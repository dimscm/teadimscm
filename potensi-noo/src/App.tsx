import { useEffect, useState } from 'react'
import { useApp } from './state/AppState'
import MapView from './components/MapView'
import MapLegend from './components/MapLegend'
import MapToolbar from './components/MapToolbar'
import NearbyPanel from './components/NearbyPanel'
import Sidebar from './components/Sidebar'
import ListView from './components/ListView'
import Dashboard from './components/Dashboard'
import FilterPanel from './components/FilterPanel'
import DetailDrawer from './components/DetailDrawer'
import SettingsSheet from './components/SettingsSheet'
import UploadScreen from './components/UploadScreen'
import { Sheet } from './components/bits'
import { formatNumber, formatRupiah } from './lib/format'

type Tab = 'peta' | 'daftar' | 'ringkasan'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'peta', label: 'Peta', icon: '◎' },
  { key: 'daftar', label: 'Daftar', icon: '☰' },
  { key: 'ringkasan', label: 'Ringkasan', icon: '▤' },
]

export default function App() {
  const { status, data, result, reference, setSelected } = useApp()
  const [tab, setTab] = useState<Tab>('peta')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [pickHint, setPickHint] = useState(false)

  useEffect(() => {
    if (status === 'ready') setReplacing(false)
  }, [status])

  useEffect(() => {
    if (reference) setPickHint(false)
  }, [reference])

  if (status === 'starting') {
    return <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">Memuat…</div>
  }

  if (status !== 'ready' || replacing) {
    return <UploadScreen onCancel={data && status === 'ready' ? () => setReplacing(false) : undefined} />
  }

  return (
    <div className="flex h-full flex-col bg-slate-100">
      <header className="z-[1100] flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="min-w-0">
          <h1 className="truncate text-base leading-tight font-bold text-slate-900 sm:text-lg">
            Peta Outlet Lintas Divisi
          </h1>
          <p className="truncate text-[11px] text-slate-500 sm:text-xs">
            {formatNumber(result.count)} outlet · {formatRupiah(result.totalOmzet)}
            {result.markedCount > 0 && (
              <span className="text-amber-700"> · {formatNumber(result.markedCount)} ditandai</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 lg:hidden"
        >
          Filter
        </button>

        <div className="ml-auto hidden items-center gap-1 rounded-xl bg-slate-100 p-1 lg:flex">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                tab === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="mr-1.5 text-xs">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 lg:hidden">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-label={item.label}
              className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
                tab === item.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {item.icon}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Pengaturan"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        >
          ⚙
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[360px] shrink-0 border-r border-slate-200 bg-white lg:block xl:w-[400px]">
          <Sidebar onMoreFilters={() => setMoreOpen(true)} />
        </aside>

        <main className="relative min-h-0 min-w-0 flex-1">
          {tab === 'peta' && (
            <>
              <MapView />
              <div className="pointer-events-none absolute inset-x-0 top-3 z-[900] flex justify-center px-3 sm:justify-start sm:pl-3">
                <MapToolbar onPickPoint={() => setPickHint(true)} />
              </div>
              {pickHint && (
                <div className="pointer-events-none absolute inset-x-0 top-20 z-[900] flex justify-center">
                  <span className="rounded-xl bg-slate-900/90 px-3 py-2 text-xs font-semibold text-white shadow-lg">
                    Ketuk satu titik di peta untuk memakainya sebagai titik A
                  </span>
                </div>
              )}
              <div className="pointer-events-none absolute bottom-3 left-3 z-[900]">
                <MapLegend />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[900] flex justify-center xl:hidden">
                <NearbyPanel onOpenDetail={setSelected} />
              </div>
            </>
          )}
          {tab === 'daftar' && <ListView />}
          {tab === 'ringkasan' && <Dashboard />}
        </main>

        {tab === 'peta' && (
          <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-3 xl:block">
            <NearbyPanel onOpenDetail={setSelected} variant="panel" />
          </aside>
        )}
      </div>

      <Sheet open={sidebarOpen} onClose={() => setSidebarOpen(false)} title="Filter & tanda" side="right">
        <div className="-mx-4 -mt-3">
          <Sidebar
            onOpenExport={() => setSidebarOpen(false)}
            onMoreFilters={() => {
              setSidebarOpen(false)
              setMoreOpen(true)
            }}
          />
        </div>
      </Sheet>

      <FilterPanel open={moreOpen} onClose={() => setMoreOpen(false)} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onReplaceData={() => setReplacing(true)} />
      <DetailDrawer />
    </div>
  )
}
