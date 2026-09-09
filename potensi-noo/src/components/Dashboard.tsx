import { useMemo } from 'react'
import { useApp } from '../state/AppState'
import { coverageMask, countDivisions, outletKecamatan, unmappedDivisions } from '../lib/dataset'
import { exportOutlets, exportVisits, download } from '../lib/export'
import { formatDateTime, formatNumber, formatRupiah } from '../lib/format'
import { DIVISIONS, DIVISION_COLORS, DIVISION_LABELS } from '../types'
import { DivisionDot, Stat } from './bits'

export default function Dashboard() {
  const { data, result, preferences, filters, visits } = useApp()

  const marking = preferences.highlightGapFor
  const gap = useMemo(() => {
    if (!data || marking.length === 0) return null
    let targetMask = 0
    for (const division of marking) targetMask |= 1 << DIVISIONS.indexOf(division)
    const seen = new Set<number>()
    const perKecamatan = new Map<string, { count: number; omzet: number }>()
    let count = 0
    let omzet = 0
    for (let i = 0; i < data.count; i += 1) {
      if (data.positionSource[i] === 0) continue
      const store = data.storeId[i]
      if (store >= 0) {
        if (seen.has(store)) continue
        seen.add(store)
      }
      const mask = coverageMask(data, i, preferences.radiusM)
      if (mask & targetMask) continue
      if (countDivisions(mask) < 2) continue
      count += 1
      const rows = store >= 0 ? (data.storeIndex.get(store) ?? [i]) : [i]
      let storeOmzet = 0
      for (const row of rows) storeOmzet += data.omzet[row]
      omzet += storeOmzet
      const key = outletKecamatan(data, i)
      const bucket = perKecamatan.get(key)
      if (bucket) {
        bucket.count += 1
        bucket.omzet += storeOmzet
      } else {
        perKecamatan.set(key, { count: 1, omzet: storeOmzet })
      }
    }
    const top = [...perKecamatan.entries()].sort((a, b) => b[1].omzet - a[1].omzet).slice(0, 10)
    return { count, omzet, top }
  }, [data, marking, preferences.radiusM])

  if (!data) return null
  const meta = data.meta
  const blind = unmappedDivisions(data)
  const maxOmzet = gap?.top[0]?.[1].omzet ?? 1

  return (
    <div className="h-full overflow-y-auto bg-slate-100 p-3 pb-24">
      <div className="mx-auto max-w-3xl space-y-4">
        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-900">Isi file</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Baris" value={formatNumber(meta.rowCount)} hint={meta.sourceName} />
            <Stat
              label="Punya titik peta"
              value={formatNumber(meta.positionedCount)}
              hint={`${formatNumber(meta.inheritedCount)} ikut baris kembarannya`}
            />
            <Stat label="Toko fisik" value={formatNumber(meta.storeCount)} hint="setelah digabung" />
            <Stat
              label="Dilayani ≥2 divisi"
              value={formatNumber(meta.multiDivisionStoreCount)}
              hint="toko yang sama di beberapa divisi"
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Diproses {formatDateTime(meta.builtAt)}
            {meta.droppedFarCount > 0 && ` · ${meta.droppedFarCount} koordinat di luar kota diabaikan`}
            {meta.noDivisionCount > 0 && ` · ${formatNumber(meta.noDivisionCount)} baris tanpa divisi`}
          </p>
        </section>

        {gap && marking.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-bold text-amber-900">
              Peluang untuk {marking.join(' & ')}
            </h2>
            <p className="mt-1 text-xs text-amber-800">
              Toko yang sudah dilayani minimal dua divisi lain, tapi belum {marking.join(' & ')}.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              <div>
                <p className="text-2xl font-bold text-amber-900">{formatNumber(gap.count)}</p>
                <p className="text-[11px] text-amber-700">toko</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-900">{formatRupiah(gap.omzet)}</p>
                <p className="text-[11px] text-amber-700">omzet 26 minggu di toko itu</p>
              </div>
            </div>

            <h3 className="mt-4 text-xs font-semibold tracking-wide text-amber-800 uppercase">Kecamatan teratas</h3>
            <ul className="mt-2 space-y-1.5">
              {gap.top.map(([name, value]) => (
                <li key={name}>
                  <div className="flex items-baseline justify-between text-[11px] text-amber-900">
                    <span className="font-medium">{name}</span>
                    <span>
                      {formatNumber(value.count)} toko · {formatRupiah(value.omzet)}
                    </span>
                  </div>
                  <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-amber-200/60">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.max(3, (value.omzet / maxOmzet) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-900">Per divisi</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 font-semibold">Divisi</th>
                  <th className="px-3 py-2 text-right font-semibold">Baris</th>
                  <th className="px-3 py-2 text-right font-semibold">Ada titik</th>
                  <th className="px-3 py-2 text-right font-semibold">Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DIVISIONS.map((division) => {
                  const bucket = meta.perDivision[division]
                  return (
                    <tr key={division}>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <DivisionDot division={division} />
                          <span>
                            <span className="block font-semibold text-slate-900">{division}</span>
                            <span className="block text-[10px] text-slate-500">{DIVISION_LABELS[division]}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatNumber(bucket.rows)}</td>
                      <td className="px-3 py-2 text-right">
                        {bucket.positioned === 0 ? (
                          <span className="text-slate-400">tidak ada</span>
                        ) : (
                          <span className="text-slate-700">{formatNumber(bucket.positioned)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatRupiah(bucket.omzet)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {blind.length > 0 && (
            <p className="mt-2 rounded-xl bg-slate-200/60 p-2 text-[11px] text-slate-600">
              {blind.map((division) => (
                <span key={division} className="font-semibold" style={{ color: DIVISION_COLORS[division] }}>
                  {division}{' '}
                </span>
              ))}
              tidak punya koordinat sama sekali di file ini, jadi cakupannya tidak bisa dinilai — angka “belum digarap”
              untuk divisi itu tidak akan akurat.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold text-slate-900">Ekspor</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                download(
                  `outlet-terfilter-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportOutlets(data, result, preferences.radiusM, visits),
                )
              }
              className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
            >
              Unduh daftar tampil ({formatNumber(result.count)})
            </button>
            <button
              type="button"
              onClick={() =>
                download(`laporan-survey-${new Date().toISOString().slice(0, 10)}.csv`, exportVisits(data, visits))
              }
              disabled={visits.size === 0}
              className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 disabled:opacity-50"
            >
              Unduh laporan survey ({formatNumber(visits.size)})
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            File CSV terbuka langsung di Excel. Kirim file laporan survey ke kantor untuk digabung ke database.
            {filters.onlyGap && ' Daftar tampil sedang dibatasi ke toko bertanda saja.'}
          </p>
        </section>
      </div>
    </div>
  )
}
