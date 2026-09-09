import { DIVISIONS, NO_DIVISION, type Dataset, type Filters, type ReferencePoint, type SortKey, type VisitRecord } from '../types'
import { countDivisions, coverageMask } from './dataset'
import { metres } from './geo'

export interface FilterResult {
  /** Rows to draw, already sorted. One row per store when grouping is on. */
  rows: Int32Array
  distance: Float64Array
  omzet: Float64Array
  /** 1 when the row is a gap for the marked division. */
  marked: Uint8Array
  count: number
  markedCount: number
  totalOmzet: number
  hiddenUnmapped: number
}

const EMPTY: FilterResult = {
  rows: new Int32Array(0),
  distance: new Float64Array(0),
  omzet: new Float64Array(0),
  marked: new Uint8Array(0),
  count: 0,
  markedCount: 0,
  totalOmzet: 0,
  hiddenUnmapped: 0,
}

function idSet(values: string[], table: string[]): Set<number> | null {
  if (values.length === 0) return null
  const wanted = new Set(values)
  const out = new Set<number>()
  for (let i = 0; i < table.length; i += 1) if (wanted.has(table[i])) out.add(i)
  return out
}

export function runFilter(
  data: Dataset | null,
  filters: Filters,
  radiusM: number,
  reference: ReferencePoint | null,
  sortKey: SortKey,
  sortDesc: boolean,
  visits: Map<number, VisitRecord>,
): FilterResult {
  if (!data) return EMPTY

  const channels = idSet(filters.channels, data.channels)
  const kecamatan = idSet(filters.kecamatan, data.kecamatan)
  const kelurahan = idSet(filters.kelurahan, data.kelurahan)
  const salesmen = idSet(filters.salesmen, data.salesmen)
  const divisions = filters.divisions.length
    ? new Set(filters.divisions.map((division) => DIVISIONS.indexOf(division)))
    : null
  const query = filters.query.trim().toUpperCase()
  // A store is "marked" only when NONE of the chosen divisions serves it yet.
  let gapMask = 0
  for (const division of filters.highlightGapFor) gapMask |= 1 << DIVISIONS.indexOf(division)

  const rows: number[] = []
  const marks: number[] = []
  let hiddenUnmapped = 0

  // storeId -> position inside `rows`, so registrations collapse as we go.
  const bestByStore = new Map<number, number>()
  const omzetByStore = new Map<number, number>()
  const rowOmzet: number[] = []

  for (let i = 0; i < data.count; i += 1) {
    const positioned = data.positionSource[i] !== 0
    if (!positioned && !filters.includeUnmapped) {
      hiddenUnmapped += 1
      continue
    }
    if (divisions && !divisions.has(data.division[i])) continue
    if (channels && !channels.has(data.channelId[i])) continue
    if (kecamatan && !kecamatan.has(data.kecamatanId[i])) continue
    if (kelurahan && !kelurahan.has(data.kelurahanId[i])) continue
    if (salesmen && !salesmen.has(data.salesmanId[i])) continue
    if (filters.minOmzet > 0 && data.omzet[i] < filters.minOmzet) continue
    if (filters.minDivisions > 1) {
      // "Already trusted by N divisions" — the shops most worth the next visit.
      if (!positioned) continue
      if (countDivisions(coverageMask(data, i, radiusM)) < filters.minDivisions) continue
    }
    if (query) {
      const name = data.names[data.nameId[i]].toUpperCase()
      if (!name.includes(query) && !String(data.codes[i]).includes(query)) {
        const address = data.addresses[data.addressId[i]].toUpperCase()
        if (!address.includes(query)) continue
      }
    }
    if (filters.onlyVisited || filters.onlyUnvisited) {
      const visited = visits.has(data.codes[i])
      if (filters.onlyVisited && !visited) continue
      if (filters.onlyUnvisited && visited) continue
    }

    let marked = 0
    if (gapMask !== 0 && positioned) {
      const mask = coverageMask(data, i, radiusM)
      marked = mask & gapMask ? 0 : 1
    }
    const store = filters.groupByStore ? data.storeId[i] : -1
    if (store >= 0) {
      omzetByStore.set(store, (omzetByStore.get(store) ?? 0) + data.omzet[i])
      const at = bestByStore.get(store)
      if (at === undefined) {
        bestByStore.set(store, rows.length)
        rows.push(i)
        marks.push(marked)
        rowOmzet.push(0)
      } else {
        // The representative is the biggest registration of the shop.
        if (data.omzet[i] > data.omzet[rows[at]]) rows[at] = i
        // One registration that is already covered clears the whole shop: a
        // shop is only an opportunity when none of its rows has been reached.
        if (!marked) marks[at] = 0
      }
    } else {
      rows.push(i)
      marks.push(marked)
      rowOmzet.push(data.omzet[i])
    }
  }

  // "Only the marked ones" has to wait until the registrations of a shop have
  // been collapsed: dropping a covered row early would turn its shop into a
  // false opportunity.
  const keep =
    filters.onlyGap && gapMask !== 0
      ? Array.from({ length: rows.length }, (_, i) => i).filter((i) => marks[i] === 1)
      : null

  const count = keep ? keep.length : rows.length
  const order = new Int32Array(count)
  for (let i = 0; i < count; i += 1) order[i] = keep ? keep[i] : i

  const omzet = new Float64Array(rows.length)
  for (const [store, at] of bestByStore) omzet[at] = omzetByStore.get(store) ?? 0
  for (let i = 0; i < rows.length; i += 1) if (omzet[i] === 0) omzet[i] = rowOmzet[i] || data.omzet[rows[i]]

  const distance = new Float64Array(rows.length).fill(Infinity)
  if (reference) {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      if (data.positionSource[row] === 0) continue
      distance[i] = metres(reference.lat, reference.lng, data.lat[row], data.lng[row])
    }
  }

  const compare = (left: number, right: number): number => {
    switch (sortKey) {
      case 'distance':
        return distance[left] - distance[right]
      case 'omzet':
        return omzet[left] - omzet[right]
      case 'kecamatan': {
        const a = data.kecamatan[data.kecamatanId[rows[left]]]
        const b = data.kecamatan[data.kecamatanId[rows[right]]]
        return a.localeCompare(b, 'id')
      }
      default: {
        const a = data.names[data.nameId[rows[left]]]
        const b = data.names[data.nameId[rows[right]]]
        return a.localeCompare(b, 'id')
      }
    }
  }
  const direction = sortDesc ? -1 : 1
  // `order` holds indexes into `rows`; sorting reorders those, not the arrays.
  const sorted = Array.from(order).sort((left, right) => {
    const result = compare(left, right)
    if (result !== 0) return result * direction
    return left - right
  })

  const outRows = new Int32Array(count)
  const outDistance = new Float64Array(count)
  const outOmzet = new Float64Array(count)
  const outMarked = new Uint8Array(count)
  let markedCount = 0
  let totalOmzet = 0
  for (let i = 0; i < count; i += 1) {
    const at = sorted[i]
    outRows[i] = rows[at]
    outDistance[i] = distance[at]
    outOmzet[i] = omzet[at]
    outMarked[i] = marks[at]
    if (marks[at]) markedCount += 1
    totalOmzet += omzet[at]
  }

  return {
    rows: outRows,
    distance: outDistance,
    omzet: outOmzet,
    marked: outMarked,
    count,
    markedCount,
    totalOmzet,
    hiddenUnmapped,
  }
}

/** Divisions serving nothing at all in the current dataset. */
export function divisionIsMappable(data: Dataset, index: number): boolean {
  if (index === NO_DIVISION) return false
  return data.meta.perDivision[DIVISIONS[index]].positioned > 0
}
