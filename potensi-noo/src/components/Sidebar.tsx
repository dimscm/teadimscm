import { useMemo } from 'react'
import { useApp } from '../state/AppState'
import { divisionCounts } from '../lib/counts'
import { unmappedDivisions } from '../lib/dataset'
import { exportOutlets, download } from '../lib/export'
import { formatNumber, formatRupiah } from '../lib/format'
import { DIVISIONS, DIVISION_COLORS, DIVISION_INITIALS, DIVISION_LABELS, UNKNOWN_COLOR, type Division } from '../types'

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/** One division button: colour swatch, name, and how many outlets it holds. */
function DivisionRow({
  division,
  count,
  active,
  onClick,
  colour,
  letter,
  disabled,
}: {
  division: string
  count: number | string
  active: boolean
  onClick: () => void
  colour: string
  letter: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-xl border-2 px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active ? 'bg-white shadow-sm' : 'border-slate-200 bg-slate-50/60 hover:bg-white'
      }`}
      style={active ? { borderColor: colour } : undefined}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ backgroundColor: colour }}
      >
        {letter}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{division}</span>
      <span className="shrink-0 text-xs font-bold text-slate-500 tabular-nums">{count}</span>
    </button>
  )
}

export default function Sidebar({
  onOpenExport,
  onMoreFilters,
}: {
  onOpenExport?: () => void
  onMoreFilters?: () => void
}) {
  const { data, filters, setFilters, resetFilters, preferences, setPreferences, result, visits } = useApp()
  const counts = useMemo(() => divisionCounts(data, preferences.radiusM), [data, preferences.radiusM])
  const blind = data ? unmappedDivisions(data) : []
  const marking = preferences.highlightGapFor

  if (!data) return null

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <section>
        <h2 className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Cari toko</h2>
        <input
          value={filters.query}
          onChange={(event) => setFilters({ query: event.target.value })}
          placeholder="Nama toko, alamat, kode, salesman…"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-slate-400 focus:bg-white focus:outline-none"
        />
      </section>

      <section>
        <h2 className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Tampilkan divisi</h2>
        <div className="grid grid-cols-2 gap-2">
          {DIVISIONS.map((division) => (
            <DivisionRow
              key={division}
              division={division}
              letter={DIVISION_INITIALS[division]}
              colour={DIVISION_COLORS[division]}
              count={formatNumber(counts.rows[division])}
              disabled={counts.rows[division] === 0}
              active={filters.divisions.includes(division)}
              onClick={() => setFilters({ divisions: toggle(filters.divisions, division) })}
            />
          ))}
        </div>
        <div className="mt-2">
          <DivisionRow
            division="Tanpa divisi"
            letter="?"
            colour={UNKNOWN_COLOR}
            count={formatNumber(counts.noDivision)}
            active={false}
            onClick={() => setFilters({ divisions: [] })}
          />
        </div>
        {filters.divisions.length > 0 && (
          <button
            type="button"
            onClick={() => setFilters({ divisions: [] })}
            className="mt-1.5 text-[11px] font-semibold text-sky-700 hover:underline"
          >
            Tampilkan semua divisi lagi
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <h2 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          Tandai peluang: belum digarap
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          Pilih divisi untuk <strong>menandai</strong> toko yang belum disentuh divisi itu. Seluruh peta tetap tampil —
          yang ditandai diberi lingkaran tebal.
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {DIVISIONS.map((division) => {
            const unknown = blind.includes(division)
            const active = marking.includes(division)
            return (
              <button
                key={division}
                type="button"
                disabled={unknown}
                onClick={() => setPreferences({ highlightGapFor: toggle(marking, division) as Division[] })}
                title={unknown ? `${division} tidak punya koordinat di file ini` : DIVISION_LABELS[division]}
                className={`flex items-center justify-between gap-1 rounded-xl border-2 px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  active ? 'text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
                style={active ? { backgroundColor: DIVISION_COLORS[division], borderColor: DIVISION_COLORS[division] } : undefined}
              >
                <span className="text-sm font-bold">{division}</span>
                <span className={`text-xs font-semibold tabular-nums ${active ? 'text-white/90' : 'text-slate-500'}`}>
                  {unknown ? '—' : formatNumber(counts.gap[division])}
                </span>
              </button>
            )
          })}
        </div>
        {marking.length > 1 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Beberapa divisi dipilih: yang ditandai hanya toko yang belum digarap <strong>semuanya</strong>.
          </p>
        )}
        {blind.length > 0 && (
          <p className="mt-1.5 text-[11px] text-slate-400">
            {blind.join(', ')} tidak bisa dipakai — tidak ada satu pun koordinat di file.
          </p>
        )}

        <label className="mt-2.5 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={filters.onlyGap}
            onChange={(event) => setFilters({ onlyGap: event.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-900"
          />
          <span className="text-xs text-slate-700">
            Sembunyikan toko lainnya{' '}
            <span className="text-slate-500">({formatNumber(result.markedCount)} ditandai)</span>
          </span>
        </label>
        {marking.length > 0 && (
          <button
            type="button"
            onClick={() => setPreferences({ highlightGapFor: [] })}
            className="mt-2 text-[11px] font-semibold text-sky-700 hover:underline"
          >
            Hapus penandaan
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">Hasil</span>
          <span className="text-sm font-bold text-slate-900">
            {formatNumber(result.count)} outlet · {formatRupiah(result.totalOmzet)}
          </span>
        </div>
        {marking.length > 0 && (
          <p className="mt-1 text-[11px] text-amber-700">
            {formatNumber(result.markedCount)} di antaranya belum digarap {marking.join(' & ')}
            {marking.length === 1 && ` · ${formatRupiah(counts.gapOmzet[marking[0]])}`}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            download(
              `potensi-${marking.join('-') || 'outlet'}-${new Date().toISOString().slice(0, 10)}.csv`,
              exportOutlets(data, result, preferences.radiusM, visits),
            )
            onOpenExport?.()
          }}
          className="mt-2.5 w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          ⬇ Ekspor hasil ke Excel (CSV)
        </button>
        {onMoreFilters && (
          <button
            type="button"
            onClick={onMoreFilters}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
          >
            Filter lain: channel, kecamatan, omzet…
          </button>
        )}
        <button
          type="button"
          onClick={resetFilters}
          className="mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          Reset semua filter
        </button>
      </section>
    </div>
  )
}
