import { DIVISIONS, type Dataset, type VisitRecord } from '../types'
import {
  coverageMask,
  gapDivisions,
  outletAddress,
  outletChannel,
  outletKecamatan,
  outletKelurahan,
  outletName,
  outletSalesman,
  storeRows,
} from './dataset'
import type { FilterResult } from './filter'
import { mapsLink } from './format'
import { writeWorkbook, type Cell } from './xlsx-write'

interface Table {
  header: string[]
  rows: Cell[][]
  widths: number[]
  /** Column holding a Google Maps URL, made clickable in the .xlsx. */
  linkColumn: number
}

/**
 * A cell that starts with =, +, - or @ is read as a formula when a CSV is
 * opened. Notes are typed by hand, so they get a quote in front.
 */
function csvCell(value: Cell): string {
  let text = value === null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[";\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(table: Table): string {
  const lines = [table.header.join(';')]
  for (const row of table.rows) lines.push(row.map(csvCell).join(';'))
  // The BOM makes Excel open it as UTF-8; ';' matches an Indonesian locale.
  return `﻿${lines.join('\r\n')}`
}

function toWorkbook(name: string, table: Table): Uint8Array {
  return writeWorkbook({
    name,
    header: table.header,
    rows: table.rows,
    widths: table.widths,
    links: {
      [table.linkColumn]: (row) => {
        const value = row[table.linkColumn]
        return typeof value === 'string' && value.startsWith('http') ? value : null
      },
    },
  })
}

export function download(filename: string, content: string | Uint8Array, type?: string): void {
  const isText = typeof content === 'string'
  const blob = new Blob([isText ? content : (content.slice().buffer as ArrayBuffer)], {
    type:
      type ??
      (isText
        ? 'text/csv;charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  })
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
function outletTable(
  data: Dataset,
  result: FilterResult,
  radiusM: number,
  visits: Map<number, VisitRecord>,
): Table {
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
  const widths = [12, 28, 20, 16, 18, 34, 24, 8, 14, 20, 18, 10, 10, 30, 11, 11, 46, 14, 18, 34, 20]

  const rows: Cell[][] = []
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
      positioned ? Number(data.lat[row].toFixed(6)) : '',
      positioned ? Number(data.lng[row].toFixed(6)) : '',
      positioned ? mapsLink(data.lat[row], data.lng[row]) : '',
      visit?.status ?? '',
      visit?.supply ?? '',
      visit?.note ?? '',
      visit?.visitedAt ?? '',
    ])
  }
  return { header, rows, widths, linkColumn: 16 }
}

export function exportOutletsCsv(
  data: Dataset,
  result: FilterResult,
  radiusM: number,
  visits: Map<number, VisitRecord>,
): string {
  return toCsv(outletTable(data, result, radiusM, visits))
}

export function exportOutletsWorkbook(
  data: Dataset,
  result: FilterResult,
  radiusM: number,
  visits: Map<number, VisitRecord>,
): Uint8Array {
  return toWorkbook('Potensi outlet', outletTable(data, result, radiusM, visits))
}

/** Only the survey notes, for pasting into the master database. */
function visitTable(data: Dataset | null, visits: Map<number, VisitRecord>): Table {
  const header = [
    'KODE OUTLET',
    'NAMA OUTLET',
    'KECAMATAN',
    'KELURAHAN',
    'STATUS',
    'SUMBER BARANG',
    'CATATAN',
    'SALES',
    'TANGGAL',
    'LATITUDE',
    'LONGITUDE',
    'LINK MAPS',
  ]
  const widths = [12, 28, 16, 18, 14, 20, 40, 22, 22, 11, 11, 46]

  const byCode = new Map<number, number>()
  if (data) for (let i = 0; i < data.count; i += 1) if (!byCode.has(data.codes[i])) byCode.set(data.codes[i], i)

  const rows: Cell[][] = []
  for (const visit of visits.values()) {
    const row = byCode.get(visit.outletCode)
    const lat = visit.lat ?? (data && row !== undefined ? data.lat[row] : undefined)
    const lng = visit.lng ?? (data && row !== undefined ? data.lng[row] : undefined)
    const positioned = Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
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
      positioned ? Number(lat!.toFixed(6)) : '',
      positioned ? Number(lng!.toFixed(6)) : '',
      positioned ? mapsLink(lat!, lng!) : '',
    ])
  }
  return { header, rows, widths, linkColumn: 11 }
}

export function exportVisitsCsv(data: Dataset | null, visits: Map<number, VisitRecord>): string {
  return toCsv(visitTable(data, visits))
}

export function exportVisitsWorkbook(data: Dataset | null, visits: Map<number, VisitRecord>): Uint8Array {
  return toWorkbook('Laporan survey', visitTable(data, visits))
}
