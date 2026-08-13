# Master Agustus — web

Tampilan web untuk `MASTER_AGUSTUS.xlsx`. Tiap **sheet di Excel = satu produk**
(Pucuk, LM 600, LM 1500+330, Nipis), dan tiap baris = satu outlet dengan target
Agustus, realisasi mingguan W31–W34, kekurangan, serta achievement-nya.

## Yang bisa dilakukan

- **Pilih produk** lewat tab di atas, atau **Semua Produk** untuk gabungan
  keempatnya (292 outlet).
- **Cari outlet** dengan mengetik nama outlet, nomor outlet, atau alamat. Bisa
  beberapa kata sekaligus, mis. `budi jaya` atau `2240607`.
- **Filter** salesman, rayon, zona/paket, dan status pencapaian (belum ada
  order, di bawah 50%, 50–99%, 100% ke atas). Isi tiap dropdown otomatis
  menyesuaikan filter lain, jadi tidak pernah menghasilkan daftar kosong.
- **Ringkasan** jumlah outlet, target, realisasi, kekurangan, dan achievement
  ikut berubah mengikuti filter yang aktif.
- **Rekap Per Salesman / Per Rayon** untuk melihat pencapaian tiap orang atau
  tiap rayon.
- **Klik satu outlet** untuk melihat detail: realisasi per minggu dan riwayat
  penjualan (kuartal-kuartal sebelumnya, rata-rata per minggu, dasar target).
- **Unduh CSV** sesuai filter yang sedang aktif.

## Menjalankan

Cukup buka `index.html` di browser — tidak perlu server, tidak perlu internet.

Berkas satu-file di `dist/master-agustus.html` isinya sama persis tetapi CSS,
JavaScript, dan datanya sudah digabung jadi satu, jadi enak dikirim lewat
WhatsApp/email atau disimpan di HP.

## Memperbarui data bulan berikutnya

```bash
python3 web/tools/build_data.py MASTER_SEPTEMBER.xlsx   # tulis ulang web/data.js
python3 web/tools/build_single.py                       # tulis ulang dist/
```

`build_data.py` memetakan kolom tiap sheet lewat tabel `SHEETS` di bagian atas
berkas. Kalau tata letak Excel-nya berubah (kolom bergeser atau ada sheet
produk baru), sesuaikan indeks kolom di situ — indeksnya 0-based, jadi kolom A
= 0, B = 1, dan seterusnya. Sheet yang belum terdaftar akan dilewati dengan
peringatan, bukan bikin error.

Angka realisasi, kekurangan, dan achievement dihitung ulang dari kolom W31–W34
dan target, bukan disalin dari rumus Excel. Hasilnya sudah dicocokkan dengan
seluruh 292 baris di workbook Agustus dan tidak ada selisih.

## Isi berkas

| Berkas | Isi |
|---|---|
| `index.html` | kerangka halaman |
| `styles.css` | tampilan, termasuk mode gelap dan tata letak HP |
| `app.js` | filter, pencarian, rekap, panel detail, ekspor CSV |
| `data.js` | data hasil ekspor Excel (dibuat otomatis) |
| `tools/build_data.py` | Excel → `data.js` |
| `tools/build_single.py` | gabung semuanya jadi satu berkas HTML |
