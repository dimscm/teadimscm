import { useState } from 'react'
import { useApp } from '../state/AppState'
import { coverageMask, outletChannel, outletName, outletSalesman, storeRows } from '../lib/dataset'
import { formatDistance } from '../lib/geo'
import { formatRupiah } from '../lib/format'
import { DivisionBadge, divisionOfIndex } from './bits'
import { DIVISIONS } from '../types'

/**
 * The headline answer: standing here, which shops are next to me, whose are
 * they, and how big are they.
 */
export default function NearbyPanel({
  onOpenDetail,
  variant = 'sheet',
}: {
  onOpenDetail: (row: number) => void
  variant?: 'sheet' | 'panel'
}) {
  const { data, result, reference, setReference, preferences, filters } = useApp()
  const [collapsed, setCollapsed] = useState(false)
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
        setReference({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: 'Lokasi saya',
          source: 'gps',
        })
      },
      () => {
        setLocating(false)
        setError('Lokasi tidak bisa diambil. Aktifkan izin lokasi, lalu coba lagi.')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  }

  const rows: number[] = []
  const distances: number[] = []
  const omzets: number[] = []
  const marks: number[] = []
  if (data && reference) {
    for (let i = 0; i < result.count && rows.length < 20; i += 1) {
      if (!Number.isFinite(result.distance[i])) continue
      rows.push(result.rows[i])
      distances.push(result.distance[i])
      omzets.push(result.omzet[i])
      marks.push(result.marked[i])
    }
  }
  const sortedByDistance = preferences.sortKey === 'distance' && !preferences.sortDesc

  if (variant === 'panel' && !reference) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-bold text-slate-900">Outlet terdekat dari titik saya</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          Tentukan titik patokan dulu — pakai GPS kalau Anda sedang di lapangan, atau ketuk satu titik di peta kalau
          sedang menyusun rencana kunjungan.
        </p>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="mt-3 w-full rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
        >
          📍 {locating ? 'Mencari…' : 'Pakai lokasi saya'}
        </button>
        <p className="mt-2 text-center text-[11px] text-slate-500">atau ketuk satu titik di peta</p>
        {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      </div>
    )
  }

  return (
    <div
      className={
        variant === 'panel'
          ? 'pointer-events-auto w-full rounded-2xl border border-slate-200 bg-white'
          : 'pointer-events-auto w-full rounded-t-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur sm:w-96 sm:rounded-2xl'
      }
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
        >
          <span>📍</span>
          {locating ? 'Mencari…' : 'Lokasi saya'}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-800">{reference?.label ?? 'Belum ada titik'}</p>
          <p className="truncate text-[11px] text-slate-500">
            {reference
              ? `${reference.lat.toFixed(5)}, ${reference.lng.toFixed(5)}`
              : 'Ketuk peta untuk memilih titik A'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          {collapsed ? 'Buka' : 'Tutup'}
        </button>
      </div>

      {error && <p className="px-3 py-2 text-xs text-rose-600">{error}</p>}

      {!collapsed && (
        <div className={variant === 'panel' ? 'max-h-[calc(100vh-260px)] overflow-y-auto' : 'max-h-[45vh] overflow-y-auto sm:max-h-[52vh]'}>
          {!reference && (
            <p className="px-3 py-4 text-sm text-slate-500">
              Tekan <strong>Lokasi saya</strong>, atau ketuk satu titik di peta. Daftar outlet terdekat dari titik itu
              akan muncul di sini.
            </p>
          )}
          {reference && rows.length === 0 && (
            <p className="px-3 py-4 text-sm text-slate-500">Tidak ada outlet yang lolos filter di sekitar titik ini.</p>
          )}
          {reference && rows.length > 0 && !sortedByDistance && (
            <p className="bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              Daftar sedang diurutkan bukan berdasarkan jarak — ubah di Pengaturan bila ingin yang terdekat di atas.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {rows.map((row, i) => {
              if (!data) return null
              const mask = coverageMask(data, row, preferences.radiusM)
              const registrations = filters.groupByStore ? storeRows(data, row).length : 1
              return (
                <li key={`${row}-${i}`}>
                  <button
                    type="button"
                    onClick={() => onOpenDetail(row)}
                    className="w-full px-3 py-2.5 text-left transition hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 w-14 shrink-0 text-xs font-bold text-sky-700">
                        {formatDistance(distances[i])}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-900">{outletName(data, row)}</span>
                          {marks[i] === 1 && (
                            <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800">
                              PELUANG
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                          {outletSalesman(data, row) || '—'} · {outletChannel(data, row)}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-xs font-bold text-slate-900">{formatRupiah(omzets[i])}</span>
                          <span className="text-[11px] text-slate-400">·</span>
                          {DIVISIONS.map((division, index) =>
                            mask & (1 << index) ? <DivisionBadge key={division} division={division} size="sm" /> : null,
                          )}
                          {registrations > 1 && (
                            <span className="text-[10px] text-slate-500">{registrations} pendaftaran</span>
                          )}
                        </span>
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
          {data && reference && rows.length > 0 && (
            <p className="px-3 py-2 text-[11px] text-slate-500">
              Divisi pemilik baris ini: <DivisionBadge division={divisionOfIndex(data.division[rows[0]])} size="sm" /> —
              badge lain berarti divisi itu juga sudah punya toko yang sama.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
