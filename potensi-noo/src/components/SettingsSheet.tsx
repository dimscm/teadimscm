import { useApp } from '../state/AppState'
import { clearVisits } from '../lib/db'
import { formatDateTime, formatNumber } from '../lib/format'
import { Sheet } from './bits'

export default function SettingsSheet({
  open,
  onClose,
  onReplaceData,
}: {
  open: boolean
  onClose: () => void
  onReplaceData: () => void
}) {
  const { data, preferences, setPreferences, visits, clearData } = useApp()

  return (
    <Sheet open={open} onClose={onClose} title="Pengaturan">
      <div className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Nama sales</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">Ikut tercatat di setiap laporan kunjungan.</span>
          <input
            value={preferences.salesName}
            onChange={(event) => setPreferences({ salesName: event.target.value })}
            placeholder="Misal: Dimas — Jakut/Jaktim"
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <div>
          <span className="text-sm font-medium text-slate-800">Radius “toko yang sama”</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Dua titik dalam radius ini dianggap toko yang sama saat menilai cakupan divisi. Standar 60 m.
          </span>
          <input
            type="range"
            min={20}
            max={300}
            step={10}
            value={preferences.radiusM}
            onChange={(event) => setPreferences({ radiusM: Number(event.target.value) })}
            className="mt-2 w-full accent-slate-900"
          />
          <p className="text-xs font-semibold text-slate-700">{preferences.radiusM} meter</p>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Data saat ini</p>
          {data ? (
            <p className="mt-1 text-sm text-slate-700">
              {data.meta.sourceName}
              <span className="block text-[11px] text-slate-500">
                {formatNumber(data.meta.rowCount)} baris · diproses {formatDateTime(data.meta.builtAt)}
              </span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Belum ada data.</p>
          )}
          <button
            type="button"
            onClick={() => {
              onClose()
              onReplaceData()
            }}
            className="mt-3 w-full rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
          >
            Ganti file Excel
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('Hapus data outlet dari HP ini? Laporan survey tetap tersimpan.')) {
                clearData()
                onClose()
              }
            }}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700"
          >
            Hapus data outlet
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Laporan survey</p>
          <p className="mt-1 text-sm text-slate-700">{formatNumber(visits.size)} toko sudah dilaporkan</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Tersimpan di HP ini. Unduh CSV-nya dari tab Ringkasan sebelum menghapus.
          </p>
          <button
            type="button"
            onClick={() => {
              if (confirm('Hapus semua laporan survey di HP ini? Tindakan ini tidak bisa dibatalkan.')) {
                clearVisits().then(() => location.reload())
              }
            }}
            disabled={visits.size === 0}
            className="mt-2 w-full rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-medium text-rose-700 disabled:opacity-50"
          >
            Hapus semua laporan
          </button>
        </div>

        <p className="text-[11px] text-slate-400">
          Semua data — file Excel maupun laporan — hanya disimpan di browser perangkat ini.
        </p>
      </div>
    </Sheet>
  )
}
