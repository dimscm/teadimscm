import { zipSync, strToU8 } from 'fflate'

/**
 * A small XLSX writer: a single sheet, a frozen bold header, an autofilter,
 * and real clickable hyperlinks.
 *
 * A CSV cannot carry a clickable link — Excel shows the URL as plain text and
 * the sales team has to copy it by hand. This writes the same table as a real
 * workbook so the Maps column is one click.
 */

export type Cell = string | number | null

export interface SheetSpec {
  name: string
  header: string[]
  rows: Cell[][]
  /** Column index -> builds the link target for that cell, or null for none. */
  links?: Record<number, (row: Cell[]) => string | null>
  /** Column widths in characters. */
  widths?: number[]
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

function escapeXml(value: string): string {
  let out = ''
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    // Control characters are illegal in XML 1.0 and make Excel refuse the file.
    if (code < 0x20 && char !== '\t' && char !== '\n') continue
    if (char === '&') out += '&amp;'
    else if (char === '<') out += '&lt;'
    else if (char === '>') out += '&gt;'
    else if (char === '"') out += '&quot;'
    else out += char
  }
  return out
}

/** 0 -> A, 25 -> Z, 26 -> AA */
function columnName(index: number): string {
  let name = ''
  let rest = index
  do {
    name = String.fromCharCode(65 + (rest % 26)) + name
    rest = Math.floor(rest / 26) - 1
  } while (rest >= 0)
  return name
}

function cellXml(ref: string, value: Cell, style: number): string {
  if (value === null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${style ? ` s="${style}"` : ''}><v>${value}</v></c>`
  }
  return `<c r="${ref}"${style ? ` s="${style}"` : ''} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`
}

const STYLES = `${XML_HEADER}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
<dxfs count="0"/>
<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
</styleSheet>`

export function writeWorkbook(sheet: SheetSpec): Uint8Array {
  const { header, rows, links = {}, widths } = sheet
  const linkColumns = Object.keys(links).map(Number)

  const parts: string[] = []
  parts.push(XML_HEADER)
  parts.push(
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
  )
  parts.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>')
  if (widths && widths.length > 0) {
    parts.push('<cols>')
    widths.forEach((width, index) => {
      parts.push(`<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    })
    parts.push('</cols>')
  }

  parts.push('<sheetData>')
  parts.push('<row r="1">')
  header.forEach((title, column) => parts.push(cellXml(`${columnName(column)}1`, title, 1)))
  parts.push('</row>')

  const hyperlinks: { ref: string; id: string; target: string }[] = []
  rows.forEach((row, index) => {
    const rowNumber = index + 2
    parts.push(`<row r="${rowNumber}">`)
    row.forEach((value, column) => {
      const ref = `${columnName(column)}${rowNumber}`
      const isLink = linkColumns.includes(column) && value !== null && value !== ''
      parts.push(cellXml(ref, value, isLink ? 2 : 0))
      if (isLink) {
        const target = links[column](row)
        if (target) {
          hyperlinks.push({ ref, id: `rIdL${hyperlinks.length + 1}`, target })
        }
      }
    })
    parts.push('</row>')
  })
  parts.push('</sheetData>')

  const lastColumn = columnName(Math.max(header.length - 1, 0))
  parts.push(`<autoFilter ref="A1:${lastColumn}${rows.length + 1}"/>`)

  if (hyperlinks.length > 0) {
    parts.push('<hyperlinks>')
    for (const link of hyperlinks) parts.push(`<hyperlink ref="${link.ref}" r:id="${link.id}"/>`)
    parts.push('</hyperlinks>')
  }
  parts.push('</worksheet>')

  const sheetRels = `${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hyperlinks
  .map(
    (link) =>
      `<Relationship Id="${link.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(link.target)}" TargetMode="External"/>`,
  )
  .join('')}
</Relationships>`

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`${XML_HEADER}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`${XML_HEADER}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheet.name).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`${XML_HEADER}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
    'xl/worksheets/sheet1.xml': strToU8(parts.join('')),
  }
  if (hyperlinks.length > 0) files['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8(sheetRels)

  return zipSync(files, { level: 6 })
}
