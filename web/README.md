# Master Target Outlet — web

Tampilan web untuk workbook target bulanan. Tiap **sheet di Excel = satu
produk**, dan tiap baris = satu outlet dengan target bulan berjalan, realisasi
mingguan, kekurangan, serta achievement-nya.

Periode yang sedang tampil: **September 2026 (W35–W39)**, dari
`TARGET_SEPTEMBER_TOKO_AI.xlsx` — 5 produk (TPH, Nipis Madu, LM 600,
LM 1500+330, Galon 15L) / 153 outlet.

> Hanya baris yang **ada nama salesman**-nya yang diambil; baris tanpa
> salesman dilewati dan jumlahnya dilaporkan saat build.

> **Satuan tidak seragam.** TPH, Nipis Madu, dan LM dihitung per karton;
> Galon 15L per galon. Kalau tab **Semua Produk** aktif, halaman memasang
> peringatan bahwa angka gabungannya mencampur dua satuan.

> **Target ada dua versi.** Workbook memberi TGT MID dan TGT MAX. Yang dipakai
> di tabel dan ringkasan adalah **MID**; target MAX dan achievement-nya
> ditampilkan di panel detail kalau nilainya berbeda.

## Yang bisa dilakukan

- **Pilih produk** lewat tab di atas, atau **Semua Produk** untuk gabungannya.
- **Cari outlet** dengan mengetik nama outlet, nomor outlet, atau alamat. Bisa
  beberapa kata sekaligus, mis. `rifai agen` atau `2038524`.
- **Filter** salesman, rayon, zona, tipe outlet (SO / GROMIN / GROSIR),
  keterangan (FIX IKAT TARGET / POTENSI), dan status pencapaian (belum ada
  order, di bawah 50%, 50–99%, 100% ke atas). Isi tiap dropdown menyesuaikan
  filter lain, jadi tidak pernah menghasilkan daftar kosong; filter yang
  isinya cuma satu nilai ikut disembunyikan.
- **Ringkasan** jumlah outlet, target, realisasi, kekurangan, dan achievement
  ikut berubah mengikuti filter yang aktif.
- **Rekap Per Salesman / Per Rayon** untuk melihat pencapaian tiap orang atau
  tiap rayon.
- **Klik satu outlet** untuk melihat detail: realisasi per minggu, target MAX
  dan achievement-nya, tipe outlet, keterangan, zona, channel LBP, potensi
  diskon (khusus galon), serta riwayat omset tiga kuartal dan acuan target.
- **Unduh CSV** sesuai filter yang sedang aktif.

## Menjalankan

Cukup buka `index.html` di browser — tidak perlu server, tidak perlu internet.

Berkas satu-file di `dist/master-target.html` isinya sama persis tetapi CSS,
JavaScript, dan datanya sudah digabung jadi satu, jadi enak dikirim lewat
WhatsApp/email atau disimpan di HP.

## Menerbitkan supaya bisa dibuka sales

Ada dua jalur, dan keduanya menyajikan isi yang sama.

**1. GitHub Pages tanpa Actions (paling cepat).** `build_single.py` sekaligus
menulis `docs/index.html` di akar repo. Di GitHub: **Settings → Pages → Build
and deployment → Source: Deploy from a branch**, pilih branch yang memuat
folder `docs`, lalu folder **/docs**, dan **Save**. Beberapa menit kemudian
situsnya hidup di `https://dimscm.github.io/teadimscm/`. Cara ini tidak
memakai GitHub Actions sama sekali.

**2. GitHub Pages lewat Actions.** `.github/workflows/pages.yml` mengunggah
seluruh folder `web/` setiap kali ada perubahan. Jalur ini butuh GitHub
Actions aktif; kalau akunnya sedang terkunci karena billing, semua job ditolak
sebelum jalan dan deploy tidak pernah terjadi. Pakai jalur 1 selama itu belum
beres.

> Situs GitHub Pages di repo publik bisa dibuka siapa saja yang tahu
> tautannya, tanpa login. Isi halaman ini adalah data outlet, nama salesman,
> alamat, dan target penjualan. Kalau itu tidak boleh terbuka ke luar,
> sebaiknya repo dipindah ke privat (Pages privat butuh paket berbayar) atau
> cukup kirim `dist/master-target.html` langsung ke tim.

## Memperbarui data bulan berikutnya

```bash
python3 web/tools/build_data.py target_oktober.xlsx   # tulis ulang web/data.js
python3 web/tools/build_single.py                     # tulis ulang dist/ + docs/
```

Yang perlu disesuaikan di `build_data.py` tiap ganti bulan:

| Bagian | Isi |
|---|---|
| `PERIODE` | mis. `"Oktober 2026"` — dipakai di judul dan nama berkas CSV |
| `WEEK_LABELS` | minggu bulan itu, mis. `["W40", …]`. Jumlahnya bebas; lebar kolom di web ikut menyesuaikan |
| `SHEETS` | nama sheet dan label produknya (tandai `"galon": True` untuk sheet galon) |
| `KOLOM`, `KOLOM_WEEK` | hanya kalau susunan kolomnya benar-benar bergeser |

Indeks kolomnya 0-based (kolom A = 0, B = 1, …). Judul blok omset dan nama
bulannya dibaca langsung dari baris header sheet, jadi tidak perlu diketik
ulang tiap bulan. Sheet yang belum terdaftar dilewati dengan peringatan,
bukan bikin error.

Angka realisasi, kekurangan, dan achievement dihitung ulang dari kolom minggu
dan kolom target, bukan disalin dari rumus Excel. Hasilnya dicocokkan ke
seluruh baris workbook tiap kali data diperbarui.

## Isi berkas

| Berkas | Isi |
|---|---|
| `index.html` | kerangka halaman |
| `styles.css` | tampilan, termasuk mode gelap dan tata letak HP |
| `app.js` | filter, pencarian, rekap, panel detail, ekspor CSV |
| `data.js` | data hasil ekspor Excel (dibuat otomatis) |
| `tools/build_data.py` | Excel → `data.js` |
| `tools/build_single.py` | gabung semuanya jadi satu berkas HTML + `docs/index.html` |
