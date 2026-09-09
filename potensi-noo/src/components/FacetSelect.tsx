import { useMemo, useState } from 'react'
import { formatNumber } from '../lib/format'

export interface FacetOption {
  value: string
  count: number
}

/**
 * A collapsed filter row that opens into a searchable checklist.
 *
 * Channel has 30-odd values and salesman has hundreds, so the list only shows
 * what matches the search box — never a thousand rows at once.
 */
export default function FacetSelect({
  title,
  allLabel,
  options,
  selected,
  onChange,
}: {
  title: string
  allLabel: string
  options: FacetOption[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const text = query.trim().toUpperCase()
    const matched = text ? options.filter((option) => option.value.toUpperCase().includes(text)) : options
    return matched.slice(0, 200)
  }, [options, query])

  const summary = selected.length === 0 ? allLabel : selected.length === 1 ? selected[0] : `${selected.length} dipilih`

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold tracking-wider text-slate-500 uppercase">{title}</span>
          <span className={`block truncate text-sm ${selected.length ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
            {summary}
          </span>
        </span>
        <span className={`shrink-0 text-slate-400 transition ${open ? 'rotate-90' : ''}`}>›</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-2.5">
          {options.length > 12 && (
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Cari ${title.toLowerCase()}…`}
              className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs focus:border-slate-400 focus:bg-white focus:outline-none"
            />
          )}
          <div className="max-h-56 overflow-y-auto pr-1">
            {shown.length === 0 && <p className="px-1 py-2 text-xs text-slate-500">Tidak ada yang cocok.</p>}
            {shown.map((option) => {
              const on = selected.includes(option.value)
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      onChange(on ? selected.filter((item) => item !== option.value) : [...selected, option.value])
                    }
                    className="h-4 w-4 shrink-0 rounded border-slate-300 accent-slate-900"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-700">{option.value}</span>
                  <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">{formatNumber(option.count)}</span>
                </label>
              )
            })}
          </div>
          {options.length > shown.length && (
            <p className="px-1 pt-1 text-[11px] text-slate-400">
              {formatNumber(options.length - shown.length)} lainnya — ketik untuk mencari.
            </p>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1.5 text-[11px] font-semibold text-sky-700 hover:underline"
            >
              Bersihkan pilihan
            </button>
          )}
        </div>
      )}
    </div>
  )
}
