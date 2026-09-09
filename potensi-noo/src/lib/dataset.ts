import { DIVISIONS, NO_DIVISION, divisionBit, type Dataset, type Division } from '../types'
import type { BuiltData } from './pipeline'

/** Attach the derived lookups the UI needs to the worker's output. */
export function materialise(built: BuiltData): Dataset {
  const storeIndex = new Map<number, number[]>()
  for (let i = 0; i < built.count; i += 1) {
    const store = built.storeId[i]
    if (store < 0) continue
    const rows = storeIndex.get(store)
    if (rows) rows.push(i)
    else storeIndex.set(store, [i])
  }
  return { ...built, storeIndex }
}

/**
 * Which divisions already serve the shop this row belongs to.
 *
 * Three signals, in falling order of confidence: the rows grouped into the same
 * physical store, a row with the same name in the same kelurahan, and any row
 * within the radius the user picked.
 */
export function coverageMask(data: Dataset, row: number, radiusM: number): number {
  let mask = data.storeMask[row] | data.nameMatch[row]
  const own = data.division[row]
  if (own !== NO_DIVISION) mask |= divisionBit(own)
  for (let index = 0; index < DIVISIONS.length; index += 1) {
    if (data.nearest[index][row] <= radiusM) mask |= divisionBit(index)
  }
  return mask
}

/** Every registration of the physical store this row belongs to. */
export function storeRows(data: Dataset, row: number): number[] {
  const store = data.storeId[row]
  if (store < 0) return [row]
  return data.storeIndex.get(store) ?? [row]
}

export function countDivisions(mask: number): number {
  let bits = 0
  let rest = mask
  while (rest) {
    bits += rest & 1
    rest >>= 1
  }
  return bits
}

export function gapDivisions(mask: number): Division[] {
  const out: Division[] = []
  for (let i = 0; i < DIVISIONS.length; i += 1) if (!(mask & (1 << i))) out.push(DIVISIONS[i])
  return out
}

export function outletName(data: Dataset, row: number): string {
  return data.names[data.nameId[row]]
}

export function outletAddress(data: Dataset, row: number): string {
  return data.addresses[data.addressId[row]]
}

export function outletChannel(data: Dataset, row: number): string {
  return data.channels[data.channelId[row]]
}

export function outletKecamatan(data: Dataset, row: number): string {
  return data.kecamatan[data.kecamatanId[row]]
}

export function outletKelurahan(data: Dataset, row: number): string {
  return data.kelurahan[data.kelurahanId[row]]
}

export function outletSalesman(data: Dataset, row: number): string {
  return data.salesmen[data.salesmanId[row]]
}

export function divisionName(data: Dataset, row: number): Division | null {
  const division = data.division[row]
  return division === NO_DIVISION ? null : DIVISIONS[division]
}

/** Divisions with no usable coordinates at all — their coverage is unknowable. */
export function unmappedDivisions(data: Dataset): Division[] {
  return DIVISIONS.filter((division) => data.meta.perDivision[division].positioned === 0)
}

/** Divisions this file can actually say something about. */
export function mappedDivisions(data: Dataset): Division[] {
  return DIVISIONS.filter((division) => data.meta.perDivision[division].positioned > 0)
}

export function sortedValues(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, 'id'))
}
