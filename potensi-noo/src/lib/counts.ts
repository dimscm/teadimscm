import { DIVISIONS, NO_DIVISION, type Dataset, type Division } from '../types'
import { coverageMask } from './dataset'

export interface DivisionCounts {
  /** Rows belonging to each division that have a place on the map. */
  rows: Record<Division, number>
  noDivision: number
  /** Physical stores no row of that division serves yet. */
  gap: Record<Division, number>
  gapOmzet: Record<Division, number>
  storeCount: number
}

const empty = (): Record<Division, number> => ({ BIS: 0, CWC: 0, MUH: 0, MU: 0, M3: 0 })

/**
 * The numbers behind the sidebar: how many outlets each division has here, and
 * how many shops it has not reached yet.
 *
 * Counted over physical stores, not registrations, so one shop registered by
 * three divisions is one opportunity — not three.
 */
export function divisionCounts(data: Dataset | null, radiusM: number): DivisionCounts {
  const result: DivisionCounts = {
    rows: empty(),
    noDivision: 0,
    gap: empty(),
    gapOmzet: empty(),
    storeCount: 0,
  }
  if (!data) return result

  for (let i = 0; i < data.count; i += 1) {
    if (data.positionSource[i] === 0) continue
    const division = data.division[i]
    if (division === NO_DIVISION) result.noDivision += 1
    else result.rows[DIVISIONS[division]] += 1
  }

  const seen = new Set<number>()
  for (let i = 0; i < data.count; i += 1) {
    if (data.positionSource[i] === 0) continue
    const store = data.storeId[i]
    if (store >= 0) {
      if (seen.has(store)) continue
      seen.add(store)
    }
    result.storeCount += 1

    // Same rule as the map: cover from any registration counts for the shop.
    let mask = 0
    let omzet = 0
    const rows = store >= 0 ? (data.storeIndex.get(store) ?? [i]) : [i]
    for (const row of rows) {
      omzet += data.omzet[row]
      mask |= coverageMask(data, row, radiusM)
    }
    for (let d = 0; d < DIVISIONS.length; d += 1) {
      if (mask & (1 << d)) continue
      result.gap[DIVISIONS[d]] += 1
      result.gapOmzet[DIVISIONS[d]] += omzet
    }
  }
  return result
}
