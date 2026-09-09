import { useState } from 'react'
import { useApp } from '../state/AppState'
import { formatNumber } from '../lib/format'
import type { ColourMode } from '../types'

const MODES: { key: ColourMode; label: string; hint: string }[] = [
  { key: 'divisi', label: 'Divisi', hint: 'Warna titik = divisi pemilik' },
  { key: 'status', label: 'Status', hint: 'Oranye = belum digarap divisi yang ditandai' },
  { key: 'omzet', label: 'Omzet', hint: 'Makin gelap, makin besar omzetnya' },
]

/** The row of controls that floats over the map. */
export default function MapToolbar({ onPickPoint }: { onPickPoint: () => void }) {
  const { preferences, setPreferences, result, setReference, requestFit } = useApp()
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locate = () => {
    if (!navigator.geolocation) {
      setError('Browser ini tidak mendukung GPS.')
      return
    }
    setLocating(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        setReference({ lat: position.coords.latitude, lng: position.coords.longitude, label: 'Lokasi saya', source: 'gps' })
      },
      () => {
        setLocating(false)
        setError('Lokasi tidak bisa diambil. Aktifkan izin lokasi lalu coba lagi.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-md transition hover:bg-slate-50 disabled:opacity-60"
      >
        📍 {locating ? 'Mencari…' : 'Lokasi saya'}
      </button>
      <button
        type="button"
        onClick={onPickPoint}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-md transition hover:bg-slate-50"
      >
        Pilih titik A
      </button>

      <button
        type="button"
        onClick={requestFit}
        title="Perbesar peta ke outlet yang sedang tampil"
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-md transition hover:bg-slate-50"
      >
        Zoom ke hasil
      </button>

      <div className="flex items-center rounded-xl border border-slate-200 bg-white p-0.5 shadow-md">
        {MODES.map((item) => (
          <button
            key={item.key}
            type="button"
            title={item.hint}
            onClick={() => setPreferences({ colourMode: item.key })}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              preferences.colourMode === item.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {result.markedCount > 0 && (
        <span className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-md">
          <span className="inline-block h-3.5 w-3.5 rounded-full border-[3px] border-amber-500 bg-white" />
          {formatNumber(result.markedCount)} toko ditandai — bercincin tebal
        </span>
      )}
      {error && (
        <span className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-md">
          {error}
        </span>
      )}
    </div>
  )
}
