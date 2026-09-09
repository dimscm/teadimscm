import { DIVISIONS, type Dataset, type VisitRecord } from '../types'
import { coverageMask, gapDivisions, outletAddress, outletChannel, outletKecamatan, outletKelurahan, outletName, outletSalesman, storeRows } from './dataset'
import type { FilterResult } from './filter'
import { mapsLink } from './format'

function csvCell(value: string | number): string {
  const text = String(value ?? '')
  if (/[";\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header.join(';')]
  for (const row of rows) lines.push(row.map(csvCell).join(';'))
  // The BOM makes Excel open it as UTF-8; ';' matches an Indonesian locale.
  return `﻿${lines.join('\r\n')}`
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** The list exactly as the user filtered it, plus the coverage verdict. */
export function exportOutlets(data: Dataset, result: FilterResult, radiusM: number, visits: Map<number, VisitRecord>): string {
  const header = [
    'KODE OUTLET',
    'NAMA OUTLET',
    'CHANNEL',
    'KECAMATAN',
    'KELURAHAN',
    'ALAMAT',
    'SALESMAN',
    'DIVISI',
    'OMZET',
    'DIVISI YANG SUDAH MASUK',
    'DIVISI YANG BELUM',
    'DITANDAI PELUANG',
    'JUMLAH PENDAFTARAN TOKO',
    'NAMA TOKO INI DI DIVISI LAIN',
    'LATITUDE',
    'LONGITUDE',
    'LINK MAPS',
    'STATUS KUNJUNGAN',
    'SUMBER BARANG',
    'CATATAN',
    'TANGGAL SURVEY',
  ]
  const rows: (string | number)[][] = []
  for (let i = 0; i < result.count; i += 1) {
    const row = result.rows[i]
    const mask = coverageMask(data, row, radiusM)
    const covered = DIVISIONS.filter((_, index) => mask & (1 << index))
    const visit = visits.get(data.codes[row])
    const positioned = data.positionSource[row] !== 0
    const registrations = storeRows(data, row)
    // The proof that this is one shop: what the other divisions call it.
    const aliases = registrations
      .filter((other) => other !== row)
      .map((other) => `${outletName(data, other)} (${DIVISIONS[data.division[other]] ?? '-'})`)
    rows.push([
      data.codes[row],
      outletName(data, row),
      outletChannel(data, row),
      outletKecamatan(data, row),
      outletKelurahan(data, row),
      outletAddress(data, row),
      outletSalesman(data, row),
      DIVISIONS[data.division[row]] ?? '-',
      Math.round(result.omzet[i]),
      covered.join(' + '),
      gapDivisions(mask).join(' + '),
      result.marked[i] ? 'YA' : '',
      registrations.length,
      aliases.join(' | '),
      positioned ? data.lat[row].toFixed(6) : '',
      positioned ? data.lng[row].toFixed(6) : '',
      positioned ? mapsLink(data.lat[row], data.lng[row]) : '',
      visit?.status ?? '',
      visit?.supply ?? '',
      visit?.note ?? '',
      visit?.visitedAt ?? '',
    ])
  }
  return toCsv(header, rows)
}

/** Only the survey notes, for pasting into the master database. */
export function exportVisits(data: Dataset | null, visits: Map<number, VisitRecord>): string {
  const header = ['KODE OUTLET', 'NAMA OUTLET', 'KECAMATAN', 'KELURAHAN', 'STATUS', 'SUMBER BARANG', 'CATATAN', 'SALES', 'TANGGAL', 'LAT SAAT ISI', 'LNG SAAT ISI']
  const byCode = new Map<number, number>()
  if (data) for (let i = 0; i < data.count; i += 1) if (!byCode.has(data.codes[i])) byCode.set(data.codes[i], i)
  const rows: (string | number)[][] = []
  for (const visit of visits.values()) {
    const row = byCode.get(visit.outletCode)
    rows.push([
      visit.outletCode,
      data && row !== undefined ? outletName(data, row) : '',
      data && row !== undefined ? outletKecamatan(data, row) : '',
      data && row !== undefined ? outletKelurahan(data, row) : '',
      visit.status,
      visit.supply,
      visit.note,
      visit.by,
      visit.visitedAt,
      visit.lat?.toFixed(6) ?? '',
      visit.lng?.toFixed(6) ?? '',
    ])
  }
  return toCsv(header, rows)
}
