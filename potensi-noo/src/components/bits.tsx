import type { ReactNode } from 'react'
import { DIVISIONS, DIVISION_COLORS, DIVISION_INITIALS, DIVISION_LABELS, NO_DIVISION, UNKNOWN_COLOR, type Division } from '../types'

export function DivisionBadge({ division, size = 'md' }: { division: Division | null; size?: 'sm' | 'md' }) {
  const colour = division ? DIVISION_COLORS[division] : UNKNOWN_COLOR
  const label = division ?? '?'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold text-white ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
      style={{ backgroundColor: colour }}
      title={division ? DIVISION_LABELS[division] : 'Tanpa divisi'}
    >
      {label}
    </span>
  )
}

export function DivisionDot({ division }: { division: Division }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: DIVISION_COLORS[division] }}
    >
      {DIVISION_INITIALS[division]}
    </span>
  )
}

export function divisionOfIndex(index: number): Division | null {
  return index === NO_DIVISION ? null : DIVISIONS[index]
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-0.5 text-lg leading-tight font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  )
}

export function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-xl border text-base transition ${
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  side = 'bottom',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  side?: 'bottom' | 'right'
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1200] flex" onKeyDown={(event) => event.key === 'Escape' && onClose()}>
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
      />
      <div
        className={
          side === 'bottom'
            ? 'relative mt-auto max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:mx-auto sm:mb-6 sm:max-w-lg sm:rounded-2xl'
            : 'relative ml-auto h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl'
        }
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Tutup
          </button>
        </div>
        <div className="px-4 pt-3 pb-6">{children}</div>
      </div>
    </div>
  )
}
