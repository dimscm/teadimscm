export const EARTH_METRES_PER_DEGREE_LAT = 110_574
export const EARTH_METRES_PER_DEGREE_LNG = 111_320

/** Metre-per-degree scale for longitude at a given latitude. */
export function lngScale(lat: number): number {
  return EARTH_METRES_PER_DEGREE_LNG * Math.cos((lat * Math.PI) / 180)
}

/**
 * Distance in metres on a local flat projection.
 *
 * Every outlet in the file sits inside one city, so the error against the
 * haversine formula is centimetres — and this runs 56k x 5 times.
 */
export function metres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const scale = lngScale((aLat + bLat) / 2)
  const dy = (aLat - bLat) * EARTH_METRES_PER_DEGREE_LAT
  const dx = (aLng - bLng) * scale
  return Math.sqrt(dx * dx + dy * dy)
}

export function formatDistance(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value < 950) return `${Math.round(value)} m`
  return `${(value / 1000).toFixed(value < 9500 ? 1 : 0)} km`
}

/** Uniform grid over projected metres, for radius queries. */
export class Grid {
  private readonly cells = new Map<number, number[]>()
  private readonly cellSize: number

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  private key(cx: number, cy: number): number {
    // 20 bits each is plenty: the data spans a few hundred cells.
    return (cx + 524288) * 1048576 + (cy + 524288)
  }

  add(x: number, y: number, index: number): void {
    const key = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize))
    const bucket = this.cells.get(key)
    if (bucket) bucket.push(index)
    else this.cells.set(key, [index])
  }

  /** Every index in the cells overlapping the square of `radius` around x,y. */
  around(x: number, y: number, radius: number, visit: (index: number) => void): void {
    const span = Math.ceil(radius / this.cellSize)
    const cx = Math.floor(x / this.cellSize)
    const cy = Math.floor(y / this.cellSize)
    for (let ix = cx - span; ix <= cx + span; ix += 1) {
      for (let iy = cy - span; iy <= cy + span; iy += 1) {
        const bucket = this.cells.get(this.key(ix, iy))
        if (!bucket) continue
        for (let i = 0; i < bucket.length; i += 1) visit(bucket[i])
      }
    }
  }
}
