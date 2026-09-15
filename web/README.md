# Master Target Outlet — web

Tampilan web untuk workbook target bulanan. Tiap **sheet di Excel = satu
produk**, dan tiap baris = satu outlet dengan target bulan berjalan, realisasi
mingguan, kekurangan, serta achievement-nya.

Periode yang sedang tampil: **September 2026 (W35–W39)** — 5 produk (TPH,
Nipis Madu, LM 600, LM 1500+330, Galon 15L) / 153 outlet, seluruhnya dari file
target bulanan `TARGET_SEPTEMBER_TOKO_AI.xlsx`.

> **Dua jenis outlet.** 68 baris bertanda **FIX IKAT TARGET** — targetnya sudah
> diikat SPK, jadi cashback-nya hak yang nyata; ditandai chip **SPK** di tabel.
> Sisanya masih **POTENSI**: cashback-nya hitungan perkiraan kalau nanti
> SPK-nya jadi.

> Hanya baris yang **ada nama salesman**-nya yang diambil; baris tanpa
> salesman dilewati dan jumlahnya dilaporkan saat build.

> **Koordinat outlet bersifat opsional.** Kalau workbook memuat satu sheet
> daftar outlet dengan kolom `KODEOUTLET`, `Latitude`, dan `Langitude`, isinya
> otomatis disambungkan ke outlet berdasarkan kode, dan panel detail
> menampilkan tautan ke Google Maps. Sheet itu dikenali dari judul kolomnya,
> bukan dari namanya, dan koordinat 0,0 dianggap belum dipetakan. Tanpa sheet
> itu semuanya tetap jalan, cuma tanpa tautan peta.

> **Satuan tidak seragam.** TPH, Nipis Madu, dan LM dihitung per karton;
> Galon 15L per galon. Kalau tab **Semua Produk** aktif, halaman memasang
> peringatan bahwa angka gabungannya mencampur dua satuan.

> **Target ada dua versi.** Workbook memberi TGT MID dan TGT MAX, dan keduanya
> ditampilkan. **MID** adalah angka utama — dipakai untuk pengurutan dan warna
> pill; **maks** menyusul di baris kecil di bawahnya pada kolom Target,
> Kurang, dan ACH, di kartu ringkasan, di rekap per salesman/rayon, serta di
> panel detail. Baris yang MID dan maks-nya sama tidak menampilkan baris
> kedua. Di CSV keduanya jadi kolom sendiri.

## Cashback

Klik satu outlet, dan bagian paling atas panel detail menjawab dua hal yang
ditanyakan sales di depan toko: **target bulan ini** dan **sisa cashback** —
berapa rupiah yang masih bisa didapat toko itu kalau targetnya dikejar sampai
akhir bulan.

Cashback dihitung dari tabel strata program, bukan disalin dari kolom mana
pun:

> **cashback = omset x tarif zona**, dan **zona ditentukan volume omset**,
> bukan oleh targetnya.

Artinya tarif per karton ikut naik kalau toko naik zona, dan berlaku untuk
seluruh volume bulan itu. Yang ditampilkan:

| Baris | Arti |
|---|---|
| Sisa cashback | selisih antara cashback kalau target tercapai dan yang sudah aman sekarang |
| Cashback aman sekarang | yang sudah dikunci omset berjalan, kalau bulan ditutup hari ini |
| Kalau target tercapai | cashback pada target bulan ini |
| Tarif sekarang / di target | rupiah per karton beserta zonanya |

Aturan yang berbeda per program, semuanya dari form monitoring resmi:

- **Nipis Madu** hanya membayar kalau ACH mencapai 100%. Program lain membayar
  mengikuti volume berapa pun yang masuk strata.
- **LM 600 dan LM 1500+330** tetap membayar meski zona akhir turun dari zona
  SPK; yang menggugurkan adalah omset yang jatuh di bawah band terendah.
- **Galon 15L** memakai tarif per galon, berbeda antara SO dan GROMIN.

> **Band strata berubah tiap bulan** mengikuti jumlah minggu — September lima
> minggu, Juli dan Agustus empat. Tarif per zona juga bisa berubah: di
> September LM 1500ML dan 330ML memakai tarif yang sama, sedangkan Agustus
> masih membedakan keduanya. Jadi tabel di `cashback.py` wajib disegarkan
> setiap form monitoring bulan baru datang.

Tabel strata ada di `tools/cashback.py`, dan `tools/uji_cashback.py`
menghitung ulang kolom cashback yang sudah tercetak di form monitoring lalu
membandingkannya baris per baris — 294 baris September, semuanya cocok.
Jalankan itu tiap kali tabel strata diubah:

```bash
python3 web/tools/uji_cashback.py MONITORING_IKAT_TARGET_Q3_....xlsx
```

> Bonus triwulan Juli–September **belum** masuk web, karena hasil triwulannya
> memang belum keluar. Yang dihitung hanya bulan berjalan.

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
- **Klik satu outlet** untuk melihat sisa cashback dan target bulan ini di
  paling atas, lalu tautan **Buka di Google Maps** (kalau koordinatnya ada),
  realisasi per minggu, target MAX dan achievement-nya, tipe outlet,
  keterangan, zona, channel LBP, serta riwayat omset tiga kuartal dan acuan
  target.
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

## Memperbarui data

Ada dua ritme, dan dua perintah yang berbeda.

**Tiap ada form monitoring baru (mingguan).** Ini yang paling sering, dan
tidak butuh file target:

```bash
python3 web/tools/refresh_monitoring.py MONITORING_IKAT_TARGET_Q3_....xlsx
python3 web/tools/build_single.py
```

Angka outlet ber-SPK diperbarui dari form itu, cashback semua baris dihitung
ulang, dan tanggal di kaki halaman ikut berganti.

**Tiap ganti bulan**, saat file target bulanan baru terbit dan daftar
outletnya berubah:

```bash
python3 web/tools/build_data.py target_oktober.xlsx \
    --monitoring MONITORING_IKAT_TARGET_Q4_....xlsx
python3 web/tools/build_single.py
```

`--monitoring` opsional; tanpa itu semua angka datang dari file target saja.

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
| `tools/build_data.py` | file target bulanan → `data.js` |
| `tools/refresh_monitoring.py` | segarkan `data.js` dari form monitoring mingguan |
| `tools/cashback.py` | tabel strata dan aturan cashback tiap program |
| `tools/uji_cashback.py` | uji tabel strata terhadap form monitoring resmi |
| `tools/build_single.py` | gabung semuanya jadi satu berkas HTML + `docs/index.html` |
