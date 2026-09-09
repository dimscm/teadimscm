export const DIVISIONS = ['BIS', 'CWC', 'MUH', 'MU', 'M3'] as const
export type Division = (typeof DIVISIONS)[number]

/** Row has no recognisable division prefix (the "(BLANK)" salesman rows). */
export const NO_DIVISION = -1

export const DIVISION_LABELS: Record<Division, string> = {
  BIS: 'Biscuit',
  CWC: 'Coklat Wafer Candy',
  MUH: 'Mayora United Home',
  MU: 'Mayora United',
  M3: 'M3',
}

/**
 * One letter per division, drawn inside every marker.
 *
 * No five-hue palette survives every colour-vision test at marker size, so the
 * letter — not the colour — is what actually tells the divisions apart. Colour
 * is the fast scan, the letter is the answer.
 */
export const DIVISION_INITIALS: Record<Division, string> = {
  BIS: 'B',
  CWC: 'C',
  MUH: 'H',
  MU: 'M',
  M3: '3',
}

export const DIVISION_COLORS: Record<Division, string> = {
  BIS: '#2563eb',
  CWC: '#b45309',
  MUH: '#0d9488',
  MU: '#db2777',
  M3: '#7c3aed',
}

export const UNKNOWN_COLOR = '#64748b'

export function divisionBit(index: number): number {
  return index < 0 ? 0 : 1 << index
}

export function maskDivisions(mask: number): Division[] {
  const out: Division[] = []
  for (let i = 0; i < DIVISIONS.length; i += 1) if (mask & (1 << i)) out.push(DIVISIONS[i])
  return out
}

/** Columnar dataset. Typed arrays keep 56k rows cheap to filter and to store. */
export interface Dataset {
  count: number
  /** Dictionary-encoded string columns. */
  names: string[]
  codes: Int32Array
  nameId: Int32Array
  salesmanId: Int32Array
  salesmen: string[]
  channelId: Int8Array
  channels: string[]
  kecamatanId: Int8Array
  kecamatan: string[]
  kelurahanId: Int16Array
  kelurahan: string[]
  addressId: Int32Array
  addresses: string[]
  omzet: Float64Array
  lat: Float32Array
  lng: Float32Array
  /** 0 = no position, 1 = from the file, 2 = inherited from a twin row. */
  positionSource: Uint8Array
  division: Int8Array
  /** Bit per division: another division sells to a row with the same name nearby. */
  nameMatch: Uint8Array
  /** Bit per division: this row belongs to a physical store that division serves. */
  storeMask: Uint8Array
  /** Metres to the closest row of each division, capped. */
  nearest: Float32Array[]
  /** Physical-store id per row, -1 when the row has no position. */
  storeId: Int32Array
  /** storeId -> row indexes. */
  storeIndex: Map<number, number[]>
  meta: DatasetMeta
}

export interface DatasetMeta {
  sourceName: string
  builtAt: string
  rowCount: number
  positionedCount: number
  inheritedCount: number
  droppedFarCount: number
  noDivisionCount: number
  storeCount: number
  multiDivisionStoreCount: number
  perDivision: Record<Division, { rows: number; positioned: number; omzet: number }>
  centre: [number, number]
}

export interface Filters {
  query: string
  divisions: Division[]
  channels: string[]
  kecamatan: string[]
  kelurahan: string[]
  minOmzet: number
  /** Mark (not hide) stores none of these divisions serve yet. */
  highlightGapFor: Division[]
  /** Show only the marked stores. Off by default: every pin stays on the map. */
  onlyGap: boolean
  /** Collapse the registrations of one physical store into a single pin. */
  groupByStore: boolean
  includeUnmapped: boolean
  onlyVisited: boolean
  onlyUnvisited: boolean
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  divisions: [],
  channels: [],
  kecamatan: [],
  kelurahan: [],
  minOmzet: 0,
  highlightGapFor: ['M3'],
  onlyGap: false,
  groupByStore: true,
  includeUnmapped: false,
  onlyVisited: false,
  onlyUnvisited: false,
}

export type SortKey = 'distance' | 'omzet' | 'name' | 'kecamatan'

/** What the pin colour means. */
export type ColourMode = 'divisi' | 'status' | 'omzet'

export const OMZET_STEPS: { limit: number; colour: string; label: string }[] = [
  { limit: 1e6, colour: '#cbd5e1', label: '< Rp 1 jt' },
  { limit: 5e6, colour: '#7dd3fc', label: 'Rp 1–5 jt' },
  { limit: 20e6, colour: '#38bdf8', label: 'Rp 5–20 jt' },
  { limit: 100e6, colour: '#0284c7', label: 'Rp 20–100 jt' },
  { limit: Infinity, colour: '#0c4a6e', label: '> Rp 100 jt' },
]

export const STATUS_COLOURS = {
  marked: '#f59e0b',
  covered: '#94a3b8',
} as const

export const SUPPLY_SOURCES = [
  'Belum tahu',
  'Beli di grosir',
  'Beli di semi grosir',
  'Dilayani sales divisi lain',
  'Dilayani distributor lain',
  'Tidak jual produk Mayora',
] as const

export type SupplySource = (typeof SUPPLY_SOURCES)[number]

export type VisitStatus = 'baru' | 'dikunjungi' | 'closing' | 'tolak'

export interface VisitRecord {
  outletCode: number
  status: VisitStatus
  supply: SupplySource | ''
  note: string
  visitedAt: string
  by: string
  lat?: number
  lng?: number
}

export interface ReferencePoint {
  lat: number
  lng: number
  label: string
  source: 'gps' | 'map' | 'outlet'
}
