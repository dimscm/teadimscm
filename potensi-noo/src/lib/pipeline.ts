import { readWorkbook, type CellValue } from './xlsx'
import { Grid, lngScale, metres, EARTH_METRES_PER_DEGREE_LAT } from './geo'
import { DIVISIONS, NO_DIVISION, divisionBit, type Dataset, type DatasetMeta, type Division } from '../types'

export type BuiltData = Omit<Dataset, 'storeIndex'>

/** Rows farther apart than this never count as coverage for each other. */
const DISTANCE_CAP_M = 300
/** A row may inherit a position only if its donors sit within this of each other. */
const DONOR_SPREAD_M = 150
/** Shorter names are too common to trust outside their own kelurahan. */
const DISTINCTIVE_NAME_CHARS = 8
/** Two rows this close are the same shopfront whatever they are called. */
const STORE_NEAR_M = 30
/** Same name, this close: still the same shop. */
const STORE_NAME_NEAR_M = 120
/** A physical store may never span more than this. */
const STORE_SPREAD_M = 45
/** Positions this far from the data's own centre are typing errors. */
const MAX_DISTANCE_FROM_CENTRE_KM = 75

const PREFIX_TO_DIVISION: Record<string, Division> = {
  BIS: 'BIS',
  CWC: 'CWC',
  MUH: 'MUH',
  M1: 'MUH',
  M2: 'MUH',
  M4: 'MUH',
  M3: 'M3',
  MU: 'MU',
  MT: 'MU',
  MUR: 'MU',
  CNS: 'MU',
}

const COLUMN_RULES: { field: Field; test: (header: string) => boolean }[] = [
  { field: 'salesman', test: (h) => h.includes('SALESMAN') },
  { field: 'code', test: (h) => h.includes('KODE') },
  { field: 'channel', test: (h) => h.includes('CHANNEL') },
  { field: 'name', test: (h) => h.includes('NAMAOUTLET') || h.includes('NAMA OUTLET') },
  { field: 'kecamatan', test: (h) => h.includes('KECAMATAN') },
  { field: 'kelurahan', test: (h) => h.includes('KELURAHAN') },
  { field: 'address', test: (h) => h.includes('ALAMAT') || h.includes('ADDRESS') },
  { field: 'omzet', test: (h) => h.includes('OMZET') || h.includes('OMSET') || h.includes('VALUE') },
  { field: 'lng', test: (h) => h === 'LONG' || h.includes('LONGITUDE') || h.includes('BUJUR') },
  { field: 'lat', test: (h) => h === 'LAT' || h.includes('LATITUDE') || h.includes('LINTANG') },
  { field: 'name', test: (h) => h.includes('NAMA') || h.includes('OUTLET') },
]

type Field = 'salesman' | 'code' | 'name' | 'kecamatan' | 'kelurahan' | 'address' | 'channel' | 'omzet' | 'lng' | 'lat'
const REQUIRED: Field[] = ['name', 'lat', 'lng']

function headerText(cell: CellValue): string {
  return String(cell ?? '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function mapColumns(header: CellValue[]): Record<Field, number> {
  const found = {} as Record<Field, number>
  for (const rule of COLUMN_RULES) {
    if (found[rule.field] !== undefined) continue
    for (let i = 0; i < header.length; i += 1) {
      const text = headerText(header[i])
      if (!text || Object.values(found).includes(i)) continue
      if (rule.test(text)) {
        found[rule.field] = i
        break
      }
    }
  }
  return found
}

const NAME_TAG = /\((?:BIS|CWC|MUH|MU|MT|M1|M2|M3|M4|CNS)\d*\)?\s*$/
const LEADING_WORDS = /^(?:TOKO|TK|TB|TOKO ?BARU|WARUNG|WR|WRG|KIOS|KIOSK|PT|CV|UD|KEDAI|GROSIR|AGEN)\s+/

/**
 * Canonical form of an outlet name.
 *
 * Divisions write the same shop differently — "TK. ANI", "ANI (BIS)", "ANI 2" —
 * so the shop words and the division tag come off before anything is compared.
 */
export function normaliseName(value: string): string {
  let text = value.toUpperCase().trim()
  text = text.replace(NAME_TAG, ' ')
  text = text.replace(/[^A-Z0-9]+/g, ' ').trim()
  for (let i = 0; i < 2; i += 1) text = text.replace(LEADING_WORDS, '')
  return text.replace(/\s+/g, ' ').trim()
}

function divisionOf(salesman: string): number {
  const text = salesman.toUpperCase().trim()
  if (!text || text.startsWith('(BLANK)')) return NO_DIVISION
  const prefix = text.split(/[-\s]/, 1)[0].trim()
  const division = PREFIX_TO_DIVISION[prefix]
  if (!division) return NO_DIVISION
  return DIVISIONS.indexOf(division)
}

class Dictionary {
  readonly values: string[] = []
  private readonly index = new Map<string, number>()

  id(value: string): number {
    const existing = this.index.get(value)
    if (existing !== undefined) return existing
    const next = this.values.length
    this.values.push(value)
    this.index.set(value, next)
    return next
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = Float64Array.from(values).sort()
  return sorted[sorted.length >> 1]
}

export interface Progress {
  step: string
  ratio: number
}

export function buildDataset(
  buffer: ArrayBuffer,
  sourceName: string,
  report: (progress: Progress) => void = () => {},
): BuiltData {
  report({ step: 'Membuka file Excel', ratio: 0.02 })
  const sheet = readWorkbook(buffer, {
    accept: (header) => {
      const columns = mapColumns(header)
      return REQUIRED.every((field) => columns[field] !== undefined)
    },
  })

  const headerRowIndex = sheet.rows.findIndex((row) => row.some((cell) => cell !== null && cell !== ''))
  const header = sheet.rows[headerRowIndex] ?? []
  const columns = mapColumns(header)
  const missing = REQUIRED.filter((field) => columns[field] === undefined)
  if (missing.length > 0) {
    throw new Error(
      `Kolom ${missing.join(', ')} tidak ditemukan. Pastikan file punya kolom NAMAOUTLET, long, dan lat.`,
    )
  }

  report({ step: 'Membaca baris', ratio: 0.15 })

  const nameDict = new Dictionary()
  const salesmanDict = new Dictionary()
  const channelDict = new Dictionary()
  const kecamatanDict = new Dictionary()
  const kelurahanDict = new Dictionary()
  const addressDict = new Dictionary()

  const codes: number[] = []
  const nameIds: number[] = []
  const normIds: number[] = []
  const salesmanIds: number[] = []
  const channelIds: number[] = []
  const kecamatanIds: number[] = []
  const kelurahanIds: number[] = []
  const addressIds: number[] = []
  const omzets: number[] = []
  const lats: number[] = []
  const lngs: number[] = []
  const divisions: number[] = []
  const normDict = new Dictionary()

  const cell = (row: CellValue[], field: Field): CellValue => {
    const at = columns[field]
    return at === undefined ? null : (row[at] ?? null)
  }
  const text = (row: CellValue[], field: Field): string => String(cell(row, field) ?? '').trim()
  const number = (row: CellValue[], field: Field): number => {
    const raw = cell(row, field)
    if (typeof raw === 'number') return raw
    if (typeof raw !== 'string') return 0
    const cleaned = raw.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }

  for (let r = headerRowIndex + 1; r < sheet.rows.length; r += 1) {
    const row = sheet.rows[r]
    if (!row || row.length === 0) continue
    const name = text(row, 'name')
    const codeRaw = cell(row, 'code')
    if (!name && codeRaw === null) continue

    let lat = number(row, 'lat')
    let lng = number(row, 'lng')
    // Some exports swap the two columns; longitudes near 107 cannot be latitudes.
    if (Math.abs(lat) > 90 || (Math.abs(lat) > 20 && Math.abs(lng) < 20)) {
      const swap = lat
      lat = lng
      lng = swap
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
      lat = 0
      lng = 0
    }

    codes.push(typeof codeRaw === 'number' ? codeRaw : Number(String(codeRaw ?? '').replace(/\D/g, '')) || 0)
    nameIds.push(nameDict.id(name || '(tanpa nama)'))
    normIds.push(normDict.id(normaliseName(name)))
    salesmanIds.push(salesmanDict.id(text(row, 'salesman')))
    channelIds.push(channelDict.id(text(row, 'channel') || 'TANPA CHANNEL'))
    kecamatanIds.push(kecamatanDict.id(text(row, 'kecamatan') || '-'))
    kelurahanIds.push(kelurahanDict.id(text(row, 'kelurahan') || '-'))
    addressIds.push(addressDict.id(text(row, 'address')))
    omzets.push(Math.max(0, number(row, 'omzet')))
    lats.push(lat)
    lngs.push(lng)
    divisions.push(divisionOf(text(row, 'salesman')))
  }

  const count = codes.length
  if (count === 0) throw new Error('Sheet ini tidak berisi baris outlet.')

  const lat = Float32Array.from(lats)
  const lng = Float32Array.from(lngs)
  const positionSource = new Uint8Array(count)
  for (let i = 0; i < count; i += 1) positionSource[i] = lat[i] !== 0 && lng[i] !== 0 ? 1 : 0

  // --- plausibility -------------------------------------------------------
  report({ step: 'Memeriksa koordinat', ratio: 0.3 })
  const knownLat: number[] = []
  const knownLng: number[] = []
  for (let i = 0; i < count; i += 1) {
    if (positionSource[i] === 1) {
      knownLat.push(lat[i])
      knownLng.push(lng[i])
    }
  }
  const centreLat = median(knownLat)
  const centreLng = median(knownLng)
  let droppedFarCount = 0
  for (let i = 0; i < count; i += 1) {
    if (positionSource[i] !== 1) continue
    if (metres(lat[i], lng[i], centreLat, centreLng) > MAX_DISTANCE_FROM_CENTRE_KM * 1000) {
      lat[i] = 0
      lng[i] = 0
      positionSource[i] = 0
      droppedFarCount += 1
    }
  }

  // --- inherit positions from twin rows -----------------------------------
  report({ step: 'Melengkapi titik peta', ratio: 0.4 })
  const donorsByKelurahan = new Map<number, number[]>()
  const donorsByKecamatan = new Map<number, number[]>()
  const kelKey = (row: number) => normIds[row] * 65536 + kelurahanIds[row]
  const kecKey = (row: number) => normIds[row] * 65536 + kecamatanIds[row]
  for (let i = 0; i < count; i += 1) {
    if (positionSource[i] !== 1 || normDict.values[normIds[i]] === '') continue
    const a = kelKey(i)
    const listA = donorsByKelurahan.get(a)
    if (listA) listA.push(i)
    else donorsByKelurahan.set(a, [i])
    const b = kecKey(i)
    const listB = donorsByKecamatan.get(b)
    if (listB) listB.push(i)
    else donorsByKecamatan.set(b, [i])
  }

  /** Centroid of the donors, but only if they agree on where the shop is. */
  const consensus = (donors: number[]): [number, number] | null => {
    if (donors.length === 0) return null
    let sumLat = 0
    let sumLng = 0
    for (const donor of donors) {
      sumLat += lat[donor]
      sumLng += lng[donor]
    }
    const cLat = sumLat / donors.length
    const cLng = sumLng / donors.length
    for (const donor of donors) {
      if (metres(lat[donor], lng[donor], cLat, cLng) > DONOR_SPREAD_M) return null
    }
    return [cLat, cLng]
  }

  let inheritedCount = 0
  for (let i = 0; i < count; i += 1) {
    if (positionSource[i] !== 0) continue
    const norm = normDict.values[normIds[i]]
    if (!norm) continue
    let point = consensus(donorsByKelurahan.get(kelKey(i)) ?? [])
    if (!point && norm.replace(/\s/g, '').length >= DISTINCTIVE_NAME_CHARS) {
      point = consensus(donorsByKecamatan.get(kecKey(i)) ?? [])
    }
    if (!point) continue
    lat[i] = point[0]
    lng[i] = point[1]
    positionSource[i] = 2
    inheritedCount += 1
  }

  // --- projected coordinates ---------------------------------------------
  const scale = lngScale(centreLat)
  const px = new Float64Array(count)
  const py = new Float64Array(count)
  const positioned: number[] = []
  for (let i = 0; i < count; i += 1) {
    if (positionSource[i] === 0) continue
    px[i] = (lng[i] - centreLng) * scale
    py[i] = (lat[i] - centreLat) * EARTH_METRES_PER_DEGREE_LAT
    positioned.push(i)
  }

  // --- nearest row of each division --------------------------------------
  report({ step: 'Menghitung jarak antar divisi', ratio: 0.55 })
  const nearest: Float32Array[] = DIVISIONS.map(() => new Float32Array(count).fill(Infinity))
  const divisionGrids = DIVISIONS.map(() => new Grid(DISTANCE_CAP_M))
  for (const i of positioned) {
    const division = divisions[i]
    if (division !== NO_DIVISION) divisionGrids[division].add(px[i], py[i], i)
  }
  for (const i of positioned) {
    for (let d = 0; d < DIVISIONS.length; d += 1) {
      let best = Infinity
      divisionGrids[d].around(px[i], py[i], DISTANCE_CAP_M, (other) => {
        if (other === i) return
        const dx = px[i] - px[other]
        const dy = py[i] - py[other]
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance < best) best = distance
      })
      if (best <= DISTANCE_CAP_M) nearest[d][i] = best
    }
  }

  // --- same name, same kelurahan -----------------------------------------
  report({ step: 'Mencocokkan nama toko', ratio: 0.7 })
  const nameMatch = new Uint8Array(count)
  const maskByName = new Map<number, number>()
  for (let i = 0; i < count; i += 1) {
    if (divisions[i] === NO_DIVISION || normDict.values[normIds[i]] === '') continue
    const key = kelKey(i)
    maskByName.set(key, (maskByName.get(key) ?? 0) | divisionBit(divisions[i]))
  }
  for (let i = 0; i < count; i += 1) {
    if (normDict.values[normIds[i]] === '') continue
    nameMatch[i] = maskByName.get(kelKey(i)) ?? 0
  }

  // --- physical stores ----------------------------------------------------
  report({ step: 'Menggabungkan toko yang sama', ratio: 0.8 })
  const { storeId, storeMask, storeCount, multiDivisionStoreCount } = groupPhysicalStores(
    count,
    positioned,
    px,
    py,
    divisions,
    normIds,
    normDict.id(''),
  )

  report({ step: 'Merapikan hasil', ratio: 0.94 })

  const perDivision = {} as DatasetMeta['perDivision']
  for (let d = 0; d < DIVISIONS.length; d += 1) {
    perDivision[DIVISIONS[d]] = { rows: 0, positioned: 0, omzet: 0 }
  }
  let noDivisionCount = 0
  for (let i = 0; i < count; i += 1) {
    const division = divisions[i]
    if (division === NO_DIVISION) {
      noDivisionCount += 1
      continue
    }
    const bucket = perDivision[DIVISIONS[division]]
    bucket.rows += 1
    bucket.omzet += omzets[i]
    if (positionSource[i] !== 0) bucket.positioned += 1
  }

  const meta: DatasetMeta = {
    sourceName,
    builtAt: new Date().toISOString(),
    rowCount: count,
    positionedCount: positioned.length,
    inheritedCount,
    droppedFarCount,
    noDivisionCount,
    storeCount,
    multiDivisionStoreCount,
    perDivision,
    centre: [centreLat, centreLng],
  }

  return {
    count,
    names: nameDict.values,
    codes: Int32Array.from(codes),
    nameId: Int32Array.from(nameIds),
    salesmen: salesmanDict.values,
    salesmanId: Int32Array.from(salesmanIds),
    channels: channelDict.values,
    channelId: Int8Array.from(channelIds),
    kecamatan: kecamatanDict.values,
    kecamatanId: Int8Array.from(kecamatanIds),
    kelurahan: kelurahanDict.values,
    kelurahanId: Int16Array.from(kelurahanIds),
    addresses: addressDict.values,
    addressId: Int32Array.from(addressIds),
    omzet: Float64Array.from(omzets),
    lat,
    lng,
    positionSource,
    division: Int8Array.from(divisions),
    nameMatch,
    storeMask,
    nearest,
    storeId,
    meta,
  }
}

/**
 * Group the registrations that are really one shopfront.
 *
 * Two rules keep this honest:
 *
 * **Same division, different name, no merge.** A division does not book one
 * shop twice under two names, so when two candidates both belong to, say, BIS
 * and their names differ, they are two shops standing next to each other — a
 * row of kiosks, a market aisle — and merging them would chain the whole row
 * into one giant "store".
 *
 * **Bounded spread.** A group may never reach further than STORE_SPREAD_M from
 * its own centre, which stops long chains of individually-close pairs.
 */
function groupPhysicalStores(
  count: number,
  positioned: number[],
  px: Float64Array,
  py: Float64Array,
  divisions: number[],
  normIds: number[],
  emptyNormId: number,
) {
  const parent = new Int32Array(count)
  for (let i = 0; i < count; i += 1) parent[i] = i

  const find = (node: number): number => {
    let root = node
    while (parent[root] !== root) root = parent[root]
    let walk = node
    while (parent[walk] !== root) {
      const next = parent[walk]
      parent[walk] = root
      walk = next
    }
    return root
  }

  // Per-group bounding box and the name each division booked in it.
  const minX = new Float64Array(count)
  const maxX = new Float64Array(count)
  const minY = new Float64Array(count)
  const maxY = new Float64Array(count)
  const divisionName = new Int32Array(count * DIVISIONS.length).fill(-1)
  for (const i of positioned) {
    minX[i] = maxX[i] = px[i]
    minY[i] = maxY[i] = py[i]
    if (divisions[i] !== NO_DIVISION && normIds[i] !== emptyNormId) {
      divisionName[i * DIVISIONS.length + divisions[i]] = normIds[i]
    }
  }

  interface Pair {
    a: number
    b: number
    d: number
  }
  const pairs: Pair[] = []
  const grid = new Grid(STORE_NAME_NEAR_M)
  for (const i of positioned) grid.add(px[i], py[i], i)
  for (const i of positioned) {
    grid.around(px[i], py[i], STORE_NAME_NEAR_M, (other) => {
      if (other <= i) return
      const dx = px[i] - px[other]
      const dy = py[i] - py[other]
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance > STORE_NAME_NEAR_M) return
      const sameName = normIds[i] === normIds[other] && normIds[i] !== emptyNormId
      if (distance > STORE_NEAR_M && !sameName) return
      if (divisions[i] !== NO_DIVISION && divisions[i] === divisions[other] && !sameName) return
      pairs.push({ a: i, b: other, d: distance })
    })
  }
  // Tightest evidence first, so a merge is never blocked by a looser one.
  pairs.sort((left, right) => left.d - right.d)

  for (const pair of pairs) {
    const rootA = find(pair.a)
    const rootB = find(pair.b)
    if (rootA === rootB) continue

    let clash = false
    for (let d = 0; d < DIVISIONS.length; d += 1) {
      const nameA = divisionName[rootA * DIVISIONS.length + d]
      const nameB = divisionName[rootB * DIVISIONS.length + d]
      if (nameA >= 0 && nameB >= 0 && nameA !== nameB) {
        clash = true
        break
      }
    }
    if (clash) continue

    const boxMinX = Math.min(minX[rootA], minX[rootB])
    const boxMaxX = Math.max(maxX[rootA], maxX[rootB])
    const boxMinY = Math.min(minY[rootA], minY[rootB])
    const boxMaxY = Math.max(maxY[rootA], maxY[rootB])
    const halfWidth = (boxMaxX - boxMinX) / 2
    const halfHeight = (boxMaxY - boxMinY) / 2
    if (Math.sqrt(halfWidth * halfWidth + halfHeight * halfHeight) > STORE_SPREAD_M) continue

    parent[rootB] = rootA
    minX[rootA] = boxMinX
    maxX[rootA] = boxMaxX
    minY[rootA] = boxMinY
    maxY[rootA] = boxMaxY
    for (let d = 0; d < DIVISIONS.length; d += 1) {
      const nameB = divisionName[rootB * DIVISIONS.length + d]
      if (nameB >= 0 && divisionName[rootA * DIVISIONS.length + d] < 0) {
        divisionName[rootA * DIVISIONS.length + d] = nameB
      }
    }
  }

  const storeId = new Int32Array(count).fill(-1)
  const storeMask = new Uint8Array(count)
  const rootToStore = new Map<number, number>()
  let storeCount = 0
  for (const i of positioned) {
    const root = find(i)
    let id = rootToStore.get(root)
    if (id === undefined) {
      id = storeCount
      storeCount += 1
      rootToStore.set(root, id)
    }
    storeId[i] = id
  }

  const maskByStore = new Uint8Array(storeCount)
  for (const i of positioned) {
    if (divisions[i] !== NO_DIVISION) maskByStore[storeId[i]] |= divisionBit(divisions[i])
  }
  let multiDivisionStoreCount = 0
  for (let i = 0; i < storeCount; i += 1) {
    let bits = 0
    let mask = maskByStore[i]
    while (mask) {
      bits += mask & 1
      mask >>= 1
    }
    if (bits >= 2) multiDivisionStoreCount += 1
  }
  for (const i of positioned) storeMask[i] = maskByStore[storeId[i]]

  return { storeId, storeMask, storeCount, multiDivisionStoreCount }
}
