import { useState } from 'react'
import { useApp } from '../state/AppState'
import { DIVISIONS, DIVISION_LABELS } from '../types'
import { DivisionDot } from './bits'

export default function MapLegend() {
  const { preferences } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <div className="pointer-events-auto">
      {open ? (
        <div className="w-52 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-lg backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Keterangan</p>
            <button type="button" onClick={() => setOpen(false)} className="text-[11px] text-slate-500">
              ✕
            </button>
          </div>
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
          <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
            <span className="inline-block h-4 w-4 rounded-full border-[3px] border-amber-500 bg-slate-300" />
            <span className="text-[11px] text-slate-700">
              {preferences.highlightGapFor ? `Belum digarap ${preferences.highlightGapFor}` : 'Tanda peluang (mati)'}
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">Huruf di dalam titik = divisi. Perbesar peta untuk melihatnya.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-2.5 py-2 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur"
        >
          <span className="flex -space-x-1">
            {DIVISIONS.map((division) => (
              <DivisionDot key={division} division={division} />
            ))}
          </span>
          Keterangan
        </button>
      )}
    </div>
  )
}
