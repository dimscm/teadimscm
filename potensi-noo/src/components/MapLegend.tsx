import { useState } from 'react'
import { useApp } from '../state/AppState'
import { formatNumber } from '../lib/format'
import { DIVISIONS, DIVISION_LABELS, OMZET_STEPS, STATUS_COLOURS } from '../types'
import { DivisionDot } from './bits'

/** What the colours on the map mean right now. */
export default function MapLegend() {
  const { preferences, result } = useApp()
  const [open, setOpen] = useState(false)
  const mode = preferences.simpleMode ? 'status' : preferences.colourMode
  const marking = preferences.highlightGapFor

  const title = mode === 'divisi' ? 'Divisi' : mode === 'status' ? 'Status garapan' : 'Omzet'

  // Plain mode gets a plain legend: two rows, no colour theory.
  if (preferences.simpleMode) {
    return (
      <div className="pointer-events-auto rounded-xl border border-slate-200 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 rotate-[-45deg] items-center justify-center rounded-full rounded-bl-none border-2 border-white bg-amber-500 shadow">
            <span className="rotate-45 text-[11px] font-extrabold text-white">!</span>
          </span>
          <span className="text-xs font-semibold text-slate-800">
            Belum digarap {marking.join(' & ') || '—'}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="ml-1.5 h-3 w-3 shrink-0 rounded-full bg-slate-400/70" />
          <span className="ml-1 text-xs text-slate-600">Sudah digarap</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
          Peta jauh: bulatan putih = jumlah toko di area itu, angka oranye = yang belum digarap. Perbesar peta
          (atau ketuk bulatannya) sampai pin tiap toko muncul.
        </p>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur"
      >
        {mode === 'divisi' ? (
          <span className="flex -space-x-1">
            {DIVISIONS.map((division) => (
              <DivisionDot key={division} division={division} />
            ))}
          </span>
        ) : mode === 'status' ? (
          <span className="flex -space-x-1">
            <span className="h-5 w-5 rounded-full border-2 border-white" style={{ background: STATUS_COLOURS.marked }} />
            <span className="h-5 w-5 rounded-full border-2 border-white" style={{ background: STATUS_COLOURS.covered }} />
          </span>
        ) : (
          <span className="flex -space-x-1">
            {OMZET_STEPS.map((step) => (
              <span
                key={step.label}
                className="h-5 w-5 rounded-full border-2 border-white"
                style={{ background: step.colour }}
              />
            ))}
          </span>
        )}
        {title}
        <span className="font-normal text-slate-500">{formatNumber(result.count)} titik ›</span>
      </button>
    )
  }

  return (
    <div className="pointer-events-auto w-56 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-lg backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Warna titik: {title}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-slate-500">
          ✕
        </button>
      </div>

      {mode === 'divisi' && (
        <ul className="space-y-1">
          {DIVISIONS.map((division) => (
            <li key={division} className="flex items-center gap-2">
              <DivisionDot division={division} />
              <span className="text-[11px] text-slate-700">
                <span className="font-semibold">{division}</span> — {DIVISION_LABELS[division]}
              </span>
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-500 text-[10px] font-bold text-white">
              ?
            </span>
            <span className="text-[11px] text-slate-700">Tanpa divisi di file</span>
          </li>
        </ul>
      )}

      {mode === 'status' && (
        <ul className="space-y-1">
          <li className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full" style={{ background: STATUS_COLOURS.marked }} />
            <span className="text-[11px] text-slate-700">
              Belum digarap {marking.join(' & ') || '(pilih divisi dulu)'}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full" style={{ background: STATUS_COLOURS.covered }} />
            <span className="text-[11px] text-slate-700">Sudah digarap</span>
          </li>
        </ul>
      )}

      {mode === 'omzet' && (
        <ul className="space-y-1">
          {OMZET_STEPS.map((step) => (
            <li key={step.label} className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full" style={{ background: step.colour }} />
              <span className="text-[11px] text-slate-700">{step.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
        <span className="inline-block h-4 w-4 rounded-full border-[3px] border-amber-500 bg-slate-300" />
        <span className="text-[11px] text-slate-700">
          {marking.length > 0 ? `Belum digarap ${marking.join(' & ')}` : 'Tanda peluang (belum dipilih)'}
        </span>
      </div>
      {mode === 'divisi' && (
        <p className="mt-1.5 text-[10px] text-slate-400">
          Gelang di sekeliling gerombolan = komposisi divisi di dalamnya. Perbesar peta untuk melihat huruf tiap toko.
        </p>
      )}
    </div>
  )
}
