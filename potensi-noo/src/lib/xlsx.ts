import { unzipSync } from 'fflate'

/**
 * A small XLSX reader: just enough to pull a sheet of strings and numbers.
 *
 * The full spreadsheet libraries on npm are either unmaintained or several
 * megabytes; this file reads the four parts an export like POTENSI_NOO.xlsx
 * actually uses — the workbook index, its relationships, the shared string
 * table, and one worksheet — and skips styles, formats and formulas.
 */

export type CellValue = string | number | null
export interface Sheet {
  name: string
  rows: CellValue[][]
}

const decoder = new TextDecoder('utf-8')

function decodeEntities(text: string): string {
  if (text.indexOf('&') === -1) return text
  return text.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (whole, body: string) => {
    switch (body) {
      case 'amp':
        return '&'
      case 'lt':
        return '<'
      case 'gt':
        return '>'
      case 'quot':
        return '"'
      case 'apos':
        return "'"
      default:
        if (body[0] !== '#') return whole
        const code = body[1] === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
        return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
  })
}

/**
 * indexOf that never looks past `to`.
 *
 * The built-in indexOf keeps scanning to the end of the string when the needle
 * is missing. In a sheet whose last 7 MB contain no `t="` at all — Excel writes
 * exactly that when thousands of blank-but-formatted rows are saved — asking
 * every cell for an attribute it does not have turns the parse into hours of
 * scanning.
 */
function findWithin(xml: string, needle: string, from: number, to: number): number {
  const limit = Math.min(to, xml.length) - needle.length
  const first = needle.charCodeAt(0)
  for (let i = from; i <= limit; i += 1) {
    if (xml.charCodeAt(i) !== first) continue
    let k = 1
    while (k < needle.length && xml.charCodeAt(i + k) === needle.charCodeAt(k)) k += 1
    if (k === needle.length) return i
  }
  return -1
}

/** Value of one XML attribute on the tag that starts at `start`. */
function attr(xml: string, start: number, end: number, name: string): string | null {
  const needle = ` ${name}="`
  const at = findWithin(xml, needle, start, end)
  if (at === -1) return null
  const from = at + needle.length
  const to = findWithin(xml, '"', from, end)
  if (to === -1) return null
  return xml.slice(from, to)
}

/** "BC12" -> 54 (zero-based column index). */
function columnIndex(ref: string): number {
  let index = 0
  for (let i = 0; i < ref.length; i += 1) {
    const code = ref.charCodeAt(i)
    if (code < 65 || code > 90) break
    index = index * 26 + (code - 64)
  }
  return index - 1
}

/** Concatenated text of every <t> inside a run of XML. */
function textOf(xml: string, from: number, to: number): string {
  let out = ''
  let cursor = from
  while (cursor < to) {
    const open = findWithin(xml, '<t', cursor, to)
    if (open === -1) break
    const gt = findWithin(xml, '>', open, to)
    if (gt === -1) break
    if (xml[gt - 1] === '/') {
      cursor = gt + 1
      continue
    }
    const close = findWithin(xml, '</t>', gt, to)
    if (close === -1) break
    out += xml.slice(gt + 1, close)
    cursor = close + 4
  }
  return decodeEntities(out)
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  let cursor = 0
  for (;;) {
    const open = xml.indexOf('<si', cursor)
    if (open === -1) break
    const gt = xml.indexOf('>', open)
    if (gt === -1) break
    if (xml[gt - 1] === '/') {
      out.push('')
      cursor = gt + 1
      continue
    }
    const close = xml.indexOf('</si>', gt)
    if (close === -1) break
    out.push(textOf(xml, gt, close))
    cursor = close + 5
  }
  return out
}

function parseSheet(xml: string, shared: string[]): CellValue[][] {
  const rows: CellValue[][] = []
  let cursor = xml.indexOf('<sheetData')
  if (cursor === -1) return rows
  const dataEnd = xml.indexOf('</sheetData>', cursor)
  const limit = dataEnd === -1 ? xml.length : dataEnd

  while (cursor < limit) {
    const rowOpen = xml.indexOf('<row', cursor)
    if (rowOpen === -1 || rowOpen >= limit) break
    const rowGt = xml.indexOf('>', rowOpen)
    if (rowGt === -1) break
    if (xml[rowGt - 1] === '/') {
      rows.push([])
      cursor = rowGt + 1
      continue
    }
    const rowClose = xml.indexOf('</row>', rowGt)
    const rowEnd = rowClose === -1 ? limit : rowClose

    const cells: CellValue[] = []
    let inner = rowGt + 1
    let nextColumn = 0
    while (inner < rowEnd) {
      const cellOpen = findWithin(xml, '<c', inner, rowEnd)
      if (cellOpen === -1) break
      const cellGt = findWithin(xml, '>', cellOpen, rowEnd)
      if (cellGt === -1) break
      const selfClosing = xml[cellGt - 1] === '/'
      const ref = attr(xml, cellOpen, cellGt, 'r')
      const type = attr(xml, cellOpen, cellGt, 't')
      const column = ref ? columnIndex(ref) : nextColumn
      nextColumn = column + 1

      let value: CellValue = null
      if (!selfClosing) {
        const cellClose = findWithin(xml, '</c>', cellGt, rowEnd)
        const cellEnd = cellClose === -1 ? rowEnd : cellClose
        if (type === 'inlineStr') {
          value = textOf(xml, cellGt, cellEnd)
        } else {
          const vOpen = findWithin(xml, '<v', cellGt, cellEnd)
          if (vOpen !== -1) {
            const vGt = findWithin(xml, '>', vOpen, cellEnd)
            const vClose = findWithin(xml, '</v>', vGt, cellEnd)
            const raw = xml.slice(vGt + 1, vClose === -1 ? cellEnd : vClose)
            if (type === 's') {
              value = shared[Number(raw)] ?? ''
            } else if (type === 'str') {
              value = decodeEntities(raw)
            } else if (type === 'b') {
              value = raw === '1' ? 1 : 0
            } else if (type === 'e') {
              value = null
            } else {
              const numeric = Number(raw)
              value = Number.isFinite(numeric) ? numeric : decodeEntities(raw)
            }
          }
        }
        inner = cellClose === -1 ? rowEnd : cellClose + 4
      } else {
        inner = cellGt + 1
      }

      if (value !== null && value !== '') {
        while (cells.length < column) cells.push(null)
        cells[column] = value
      }
    }
    rows.push(cells)
    cursor = rowClose === -1 ? rowEnd : rowClose + 6
  }
  return rows
}

interface SheetEntry {
  name: string
  path: string
}

function listSheets(files: Record<string, Uint8Array>): SheetEntry[] {
  const workbook = files['xl/workbook.xml']
  if (!workbook) return []
  const xml = decoder.decode(workbook)
  const relsRaw = files['xl/_rels/workbook.xml.rels']
  const rels = new Map<string, string>()
  if (relsRaw) {
    const relXml = decoder.decode(relsRaw)
    const pattern = /<Relationship\b[^>]*>/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(relXml))) {
      const tag = match[0]
      const id = /\bId="([^"]+)"/.exec(tag)?.[1]
      let target = /\bTarget="([^"]+)"/.exec(tag)?.[1]
      if (!id || !target) continue
      target = target.replace(/^\/?xl\//, '').replace(/^\//, '')
      rels.set(id, `xl/${target}`)
    }
  }

  const out: SheetEntry[] = []
  const pattern = /<sheet\b[^>]*>/g
  let match: RegExpExecArray | null
  let fallback = 1
  while ((match = pattern.exec(xml))) {
    const tag = match[0]
    const name = decodeEntities(/\bname="([^"]*)"/.exec(tag)?.[1] ?? `Sheet${fallback}`)
    const rid = /\br:id="([^"]+)"/.exec(tag)?.[1]
    const path = (rid && rels.get(rid)) || `xl/worksheets/sheet${fallback}.xml`
    out.push({ name, path })
    fallback += 1
  }
  return out
}

export interface ReadOptions {
  /** Called with a sheet's first row; return true to accept that sheet. */
  accept?: (header: CellValue[], name: string) => boolean
}

export function readWorkbook(buffer: ArrayBuffer, options: ReadOptions = {}): Sheet {
  let files: Record<string, Uint8Array>
  try {
    // An .xlsx is a zip; anything else fails here, with a message worth showing.
    files = unzipSync(new Uint8Array(buffer))
  } catch {
    throw new Error(
      'File ini tidak bisa dibuka sebagai .xlsx. Kalau filenya masih format lama (.xls) atau .csv, buka di Excel lalu "Save As" ke Excel Workbook (.xlsx).',
    )
  }
  const sharedRaw = files['xl/sharedStrings.xml']
  const shared = sharedRaw ? parseSharedStrings(decoder.decode(sharedRaw)) : []
  const sheets = listSheets(files)
  if (sheets.length === 0) throw new Error('File ini bukan file Excel (.xlsx) yang bisa dibaca.')

  let firstNonEmpty: Sheet | null = null
  for (const sheet of sheets) {
    const raw = files[sheet.path]
    if (!raw) continue
    const rows = parseSheet(decoder.decode(raw), shared)
    if (rows.length === 0) continue
    const header = rows.find((row) => row.some((cell) => cell !== null && cell !== ''))
    if (!header) continue
    if (!options.accept || options.accept(header, sheet.name)) return { name: sheet.name, rows }
    if (!firstNonEmpty) firstNonEmpty = { name: sheet.name, rows }
  }
  if (firstNonEmpty) return firstNonEmpty
  throw new Error('Tidak ada sheet berisi data di file ini.')
}
