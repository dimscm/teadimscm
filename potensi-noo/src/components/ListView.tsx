import { useEffect, useState } from 'react'
import { useApp } from '../state/AppState'
import { coverageMask, outletChannel, outletKecamatan, outletKelurahan, outletName, outletSalesman, storeRows } from '../lib/dataset'
import { formatDistance } from '../lib/geo'
import { formatNumber, formatRupiah } from '../lib/format'
import { DIVISIONS, type SortKey } from '../types'
import { DivisionBadge } from './bits'

const PAGE = 100

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'distance', label: 'Jarak' },
  { key: 'omzet', label: 'Omzet' },
  { key: 'name', label: 'Nama' },
  { key: 'kecamatan', label: 'Kecamatan' },
]

export default function ListView() {
  const { data, result, preferences, setPreferences, setSelected, filters, visits } = useApp()
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    setLimit(PAGE)
  }, [result])

  if (!data) return null
  const shown = Math.min(limit, result.count)

  return (
    <div className="h-full overflow-y-auto bg-slate-100 pb-24">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-600">
            <strong className="text-slate-900">{formatNumber(result.count)}</strong> baris ·{' '}
            {formatRupiah(result.totalOmzet)}
          </p>
          <div className="flex items-center gap-1">
            {SORTS.map((sort) => (
              <button
                key={sort.key}
                type="button"
                onClick={() =>
                  setPreferences(
                    preferences.sortKey === sort.key
                      ? { sortDesc: !preferences.sortDesc }
                      : { sortKey: sort.key, sortDesc: sort.key === 'omzet' },
                  )
                }
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                  preferences.sortKey === sort.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {sort.label}
                {preferences.sortKey === sort.key && (preferences.sortDesc ? ' ↓' : ' ↑')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 bg-white">
        {Array.from({ length: shown }, (_, i) => {
          const row = result.rows[i]
          const mask = coverageMask(data, row, preferences.radiusM)
          const registrations = filters.groupByStore ? storeRows(data, row).length : 1
          const visited = visits.has(data.codes[row])
          return (
            <li key={`${row}-${i}`}>
              <button
                type="button"
                onClick={() => setSelected(row)}
                className="w-full px-3 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-slate-900">{outletName(data, row)}</span>
                      {result.marked[i] === 1 && (
                        <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-800">
                          PELUANG
                        </span>
                      )}
                      {visited && (
                        <span className="shrink-0 rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-bold text-emerald-800">
                          ✓
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-slate-500">
                      {outletKelurahan(data, row)}, {outletKecamatan(data, row)} · {outletChannel(data, row)}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{outletSalesman(data, row) || '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-900">{formatRupiah(result.omzet[i])}</p>
                    {Number.isFinite(result.distance[i]) && (
                      <p className="text-[11px] font-semibold text-sky-700">{formatDistance(result.distance[i])}</p>
                    )}
                    <p className="mt-1 flex justify-end gap-0.5">
                      {DIVISIONS.map((division, index) =>
                        mask & (1 << index) ? <DivisionBadge key={division} division={division} size="sm" /> : null,
                      )}
                    </p>
                    {registrations > 1 && <p className="text-[10px] text-slate-400">{registrations} pendaftaran</p>}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {shown < result.count && (
        <div className="p-3">
          <button
            type="button"
            onClick={() => setLimit((value) => value + PAGE * 5)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-700"
          >
            Tampilkan {formatNumber(Math.min(PAGE * 5, result.count - shown))} baris lagi
          </button>
        </div>
      )}
      {result.count === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">
          Tidak ada baris yang cocok. Longgarkan filter atau tekan “Reset filter”.
        </p>
      )}
    </div>
  )
}
