import { useRef, useState, type DragEvent } from 'react'
import { useApp } from '../state/AppState'

const COLUMNS = ['SALESMAN BEFORE', 'KODEOUTLET', 'NAMAOUTLET', 'KECAMATAN', 'KELURAHAN', 'ALAMAT', 'NAMACHANNEL', 'OMZET', 'long', 'lat']

export default function UploadScreen({ onCancel }: { onCancel?: () => void }) {
  const { status, progress, error, ingest } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const busy = status === 'building'

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    ingest(file)
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (!busy) take(event.dataTransfer.files)
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-2xl">
            🗺️
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Peta Potensi NOO</h1>
          <p className="mt-1 text-sm text-slate-600">
            Masukkan file Excel POTENSI NOO — peta, jarak antar divisi, dan daftar toko dibuat otomatis.
          </p>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault()
            if (!busy) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed bg-white p-6 text-center transition ${
            dragging ? 'border-sky-500 bg-sky-50' : 'border-slate-300'
          }`}
        >
          {busy ? (
            <div className="py-4">
              <div className="mb-3 text-sm font-medium text-slate-700">{progress?.step ?? 'Memproses'}…</div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-sky-600 transition-all duration-300"
                  style={{ width: `${Math.round((progress?.ratio ?? 0) * 100)}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                File 56.000 baris biasanya selesai dalam beberapa detik. Jangan tutup halaman ini.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">Tarik file ke sini, atau</p>
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="mt-3 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                Pilih file Excel (.xlsx)
              </button>
              <input
                ref={input}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(event) => {
                  take(event.target.files)
                  event.target.value = ''
                }}
              />
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="mt-3 block w-full text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
                >
                  Batal, pakai data yang sudah ada
                </button>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="font-semibold">File belum bisa dipakai</p>
            <p className="mt-1">{error}</p>
            <p className="mt-2 text-xs text-rose-700">
              Pastikan file berformat <strong>.xlsx</strong> (bukan .xls atau .csv) dan sheet-nya berisi kolom di bawah.
            </p>
          </div>
        )}

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Kolom yang dibaca</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COLUMNS.map((column) => (
              <span key={column} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                {column}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Nama kolom boleh berbeda sedikit — yang wajib ada hanya nama outlet, <span className="font-mono">long</span>,
            dan <span className="font-mono">lat</span>. Baris tanpa koordinat tetap dipakai bila ada baris kembarannya.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          🔒 File diproses di dalam browser ini. Datanya tidak dikirim ke server mana pun dan tidak ikut tersimpan di
          GitHub.
        </p>
      </div>
    </div>
  )
}
