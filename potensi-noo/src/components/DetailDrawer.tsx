import { useState } from 'react'
import { useApp } from '../state/AppState'
import {
  coverageMask,
  divisionName,
  outletAddress,
  outletChannel,
  outletKecamatan,
  outletKelurahan,
  outletName,
  outletSalesman,
  storeRows,
  unmappedDivisions,
} from '../lib/dataset'
import { formatDistance, metres } from '../lib/geo'
import { directionsLink, formatDateTime, formatRupiah, formatRupiahFull, mapsLink } from '../lib/format'
import { DIVISIONS, DIVISION_LABELS, SUPPLY_SOURCES, type SupplySource, type VisitStatus } from '../types'
import { DivisionBadge, Sheet } from './bits'

const STATUS_LABELS: Record<VisitStatus, string> = {
  baru: 'Belum dikunjungi',
  dikunjungi: 'Sudah dikunjungi',
  closing: 'Closing / jadi NOO',
  tolak: 'Menolak',
}

export default function DetailDrawer() {
  const { data, selected, setSelected } = useApp()
  const open = selected !== null && data !== null

  return (
    <Sheet open={open} onClose={() => setSelected(null)} title="Detail toko">
      {open && selected !== null && <DetailBody key={selected} row={selected} />}
    </Sheet>
  )
}

function DetailBody({ row: index }: { row: number }) {
  const { data, preferences, visits, saveVisit, removeVisit } = useApp()
  const dataset = data!
  const mask = coverageMask(dataset, index, preferences.radiusM)
  const registrations = storeRows(dataset, index)
  const blind = unmappedDivisions(dataset)
  const positioned = dataset.positionSource[index] !== 0
  const visit = visits.get(dataset.codes[index])

  const [status, setStatus] = useState<VisitStatus>(visit?.status ?? 'dikunjungi')
  const [supply, setSupply] = useState<SupplySource | ''>(visit?.supply ?? '')
  const [note, setNote] = useState(visit?.note ?? '')
  const [saved, setSaved] = useState(false)

  const submit = () => {
    const record = {
      status,
      supply,
      note: note.trim(),
      by: preferences.salesName,
      visitedAt: new Date().toISOString(),
      lat: positioned ? dataset.lat[index] : undefined,
      lng: positioned ? dataset.lng[index] : undefined,
    }
    saveVisit(dataset.codes[index], record)
    setSaved(true)
  }

  return (
    <div className="space-y-4">
      <header>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg leading-tight font-bold text-slate-900">{outletName(dataset, index)}</h3>
          <DivisionBadge division={divisionName(dataset, index)} />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Kode {dataset.codes[index]} · {outletChannel(dataset, index)}
        </p>
        <p className="mt-1 text-sm text-slate-600">{outletAddress(dataset, index) || 'Alamat tidak dicatat'}</p>
        <p className="text-xs text-slate-500">
          {outletKelurahan(dataset, index)}, {outletKecamatan(dataset, index)}
        </p>
        <p className="mt-2 text-sm">
          <span className="font-bold text-slate-900">{formatRupiahFull(dataset.omzet[index])}</span>
          <span className="text-xs text-slate-500"> omzet 26 minggu · sales {outletSalesman(dataset, index) || '—'}</span>
        </p>
        {dataset.positionSource[index] === 2 && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
            Titik peta diambil dari baris kembarannya — koordinat aslinya kosong di Excel.
          </p>
        )}
      </header>

      {positioned && (
        <div className="grid grid-cols-2 gap-2">
          <a
            href={mapsLink(dataset.lat[index], dataset.lng[index])}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-slate-900 px-3 py-2.5 text-center text-sm font-semibold text-white"
          >
            Buka di Maps
          </a>
          <a
            href={directionsLink(dataset.lat[index], dataset.lng[index])}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-center text-sm font-semibold text-slate-800"
          >
            Rute ke sini
          </a>
        </div>
      )}

      <section>
        <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Divisi yang sudah masuk</h4>
        <div className="mt-2 space-y-1.5">
          {DIVISIONS.map((division, divisionIndex) => {
            const covered = (mask & (1 << divisionIndex)) !== 0
            const nearestMetres = dataset.nearest[divisionIndex][index]
            const unknown = blind.includes(division)
            return (
              <div
                key={division}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                  covered ? 'bg-emerald-50' : unknown ? 'bg-slate-50' : 'bg-amber-50'
                }`}
              >
                <DivisionBadge division={division} size="sm" />
                <span className="flex-1 text-xs text-slate-700">{DIVISION_LABELS[division]}</span>
                <span
                  className={`text-xs font-semibold ${
                    covered ? 'text-emerald-700' : unknown ? 'text-slate-500' : 'text-amber-700'
                  }`}
                >
                  {covered
                    ? Number.isFinite(nearestMetres) && nearestMetres > 0
                      ? `sudah · ${formatDistance(nearestMetres)}`
                      : 'sudah'
                    : unknown
                      ? 'belum bisa diperiksa'
                      : 'belum'}
                </span>
              </div>
            )
          })}
        </div>
        {blind.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            {blind.join(', ')} tidak punya satu pun koordinat di file ini, jadi statusnya tidak bisa dipastikan —
            bukan berarti pasarnya kosong.
          </p>
        )}
      </section>

      {registrations.length > 1 && (
        <section>
          <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Toko yang sama, {registrations.length} pendaftaran
          </h4>
          <p className="mt-1 text-[11px] text-slate-500">
            Baris di bawah berdiri di titik yang sama, jadi ini satu toko fisik walaupun namanya ditulis berbeda tiap
            divisi.
          </p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {registrations.map((other) => (
              <li key={other} className="flex items-center gap-2 px-2.5 py-2">
                <DivisionBadge division={divisionName(dataset, other)} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-800">{outletName(dataset, other)}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {dataset.codes[other]} · {formatRupiah(dataset.omzet[other])}
                  </span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {formatDistance(
                    metres(dataset.lat[index], dataset.lng[index], dataset.lat[other], dataset.lng[other]),
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 p-3">
        <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Laporan kunjungan</h4>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(Object.keys(STATUS_LABELS) as VisitStatus[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                status === value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {STATUS_LABELS[value]}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs font-medium text-slate-600">
          Selama ini toko beli dari mana?
          <select
            value={supply}
            onChange={(event) => setSupply(event.target.value as SupplySource)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">— pilih —</option>
            {SUPPLY_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-xs font-medium text-slate-600">
          Catatan
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Misal: toko Ahmad beli di grosir Pasar Sunter, minta harga karton."
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
          />
        </label>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Simpan laporan
          </button>
          {visit && (
            <button
              type="button"
              onClick={() => removeVisit(dataset.codes[index])}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-600"
            >
              Hapus
            </button>
          )}
        </div>
        {saved && <p className="mt-2 text-xs font-medium text-emerald-700">Tersimpan di HP ini.</p>}
        {visit && (
          <p className="mt-2 text-[11px] text-slate-500">
            Terakhir diisi {formatDateTime(visit.visitedAt)}
            {visit.by ? ` oleh ${visit.by}` : ''}. Kirim ke kantor lewat menu Ekspor.
          </p>
        )}
      </section>
    </div>
  )
}
