import { useMemo } from 'react'
import { useApp } from '../state/AppState'
import { sortedValues, unmappedDivisions } from '../lib/dataset'
import { formatNumber, formatRupiah } from '../lib/format'
import { DIVISIONS, type Division } from '../types'
import { DivisionDot, Sheet } from './bits'

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-900"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </label>
  )
}

function ChipGroup({
  values,
  selected,
  onToggle,
  max = 24,
}: {
  values: string[]
  selected: string[]
  onToggle: (value: string) => void
  max?: number
}) {
  const list = values.slice(0, max)
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((value) => {
        const on = selected.includes(value)
        return (
          <button
            key={value}
            type="button"
            onClick={() => onToggle(value)}
            className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
              on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {value}
          </button>
        )
      })}
    </div>
  )
}

export default function FilterPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, filters, setFilters, resetFilters, preferences, setPreferences, result } = useApp()

  const channels = useMemo(() => (data ? sortedValues(data.channels) : []), [data])
  const kecamatan = useMemo(() => (data ? sortedValues(data.kecamatan) : []), [data])
  const kelurahan = useMemo(() => {
    if (!data) return []
    if (filters.kecamatan.length === 0) return sortedValues(data.kelurahan)
    const allowed = new Set<string>()
    const wanted = new Set(filters.kecamatan)
    for (let i = 0; i < data.count; i += 1) {
      if (wanted.has(data.kecamatan[data.kecamatanId[i]])) allowed.add(data.kelurahan[data.kelurahanId[i]])
    }
    return sortedValues([...allowed])
  }, [data, filters.kecamatan])

  const blind = data ? unmappedDivisions(data) : []

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

  return (
    <Sheet open={open} onClose={onClose} title="Filter & tanda">
      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <strong className="text-slate-900">{formatNumber(result.count)}</strong> titik tampil ·{' '}
          {formatRupiah(result.totalOmzet)}
          {result.markedCount > 0 && (
            <>
              {' '}
              · <strong className="text-amber-700">{formatNumber(result.markedCount)}</strong> ditandai peluang
            </>
          )}
        </div>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Tandai peluang divisi</h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setPreferences({ highlightGapFor: null })}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                preferences.highlightGapFor === null
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              Tidak ada
            </button>
            {DIVISIONS.map((division) => (
              <button
                key={division}
                type="button"
                onClick={() => setPreferences({ highlightGapFor: division as Division })}
                disabled={blind.includes(division)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  preferences.highlightGapFor === division
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <DivisionDot division={division} />
                {division}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Toko yang sudah dilayani divisi lain tapi belum divisi ini diberi lingkaran oranye — semua titik tetap
            tampil.
          </p>
          {blind.length > 0 && (
            <p className="mt-1 text-[11px] text-slate-400">
              {blind.join(', ')} tidak bisa dipakai: tidak ada koordinat di file.
            </p>
          )}
          <Toggle
            checked={filters.onlyGap}
            onChange={(value) => setFilters({ onlyGap: value })}
            label="Tampilkan hanya yang ditandai"
            hint="Matikan kalau ingin melihat seluruh peta."
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Divisi pemilik baris</h3>
          <div className="flex flex-wrap gap-1.5">
            {DIVISIONS.map((division) => {
              const on = filters.divisions.includes(division)
              return (
                <button
                  key={division}
                  type="button"
                  onClick={() =>
                    setFilters({
                      divisions: on
                        ? filters.divisions.filter((item) => item !== division)
                        : [...filters.divisions, division],
                    })
                  }
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <DivisionDot division={division} />
                  {division}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Channel</h3>
          <ChipGroup
            values={channels}
            selected={filters.channels}
            onToggle={(value) => setFilters({ channels: toggle(filters.channels, value) })}
            max={40}
          />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Kecamatan</h3>
          <ChipGroup
            values={kecamatan}
            selected={filters.kecamatan}
            onToggle={(value) =>
              setFilters({ kecamatan: toggle(filters.kecamatan, value), kelurahan: [] })
            }
            max={40}
          />
        </section>

        {kelurahan.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Kelurahan</h3>
            <ChipGroup
              values={kelurahan}
              selected={filters.kelurahan}
              onToggle={(value) => setFilters({ kelurahan: toggle(filters.kelurahan, value) })}
              max={60}
            />
          </section>
        )}

        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Omzet minimal</h3>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={Math.round(filters.minOmzet / 1e6)}
            onChange={(event) => setFilters({ minOmzet: Number(event.target.value) * 1e6 })}
            className="w-full accent-slate-900"
          />
          <p className="text-xs text-slate-600">
            {filters.minOmzet === 0 ? 'Semua omzet' : `Minimal ${formatRupiah(filters.minOmzet)}`}
          </p>
        </section>

        <section>
          <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Tampilan</h3>
          <Toggle
            checked={filters.groupByStore}
            onChange={(value) => setPreferences({ groupByStore: value })}
            label="Gabungkan toko yang sama"
            hint="Satu toko fisik jadi satu titik, walaupun didaftarkan beberapa divisi dengan nama berbeda."
          />
          <Toggle
            checked={filters.includeUnmapped}
            onChange={(value) => setPreferences({ includeUnmapped: value })}
            label="Ikutkan baris tanpa koordinat"
            hint={`${formatNumber(result.hiddenUnmapped)} baris tidak punya titik peta dan hanya muncul di daftar.`}
          />
          <Toggle
            checked={filters.onlyUnvisited}
            onChange={(value) => setFilters({ onlyUnvisited: value, onlyVisited: value ? false : filters.onlyVisited })}
            label="Hanya yang belum dilaporkan"
          />
          <Toggle
            checked={filters.onlyVisited}
            onChange={(value) => setFilters({ onlyVisited: value, onlyUnvisited: value ? false : filters.onlyUnvisited })}
            label="Hanya yang sudah dilaporkan"
          />
        </section>

        <button
          type="button"
          onClick={resetFilters}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700"
        >
          Reset filter
        </button>
      </div>
    </Sheet>
  )
}
