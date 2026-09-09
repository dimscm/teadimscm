const numberFormat = new Intl.NumberFormat('id-ID')

export function formatNumber(value: number): string {
  return numberFormat.format(Math.round(value))
}

/** Rupiah, shortened the way the sales team writes it. */
export function formatRupiah(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return 'Rp 0'
  if (value >= 1e12) return `Rp ${(value / 1e12).toFixed(1).replace('.', ',')} T`
  if (value >= 1e9) return `Rp ${(value / 1e9).toFixed(1).replace('.', ',')} M`
  if (value >= 1e6) return `Rp ${(value / 1e6).toFixed(1).replace('.', ',')} jt`
  if (value >= 1e3) return `Rp ${Math.round(value / 1e3)} rb`
  return `Rp ${formatNumber(value)}`
}

export function formatRupiahFull(value: number): string {
  return `Rp ${formatNumber(value)}`
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`
}

export function directionsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`
}
