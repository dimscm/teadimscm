# Master Target Outlet — web

Tampilan web untuk workbook target bulanan. Tiap **sheet di Excel = satu
produk**, dan tiap baris = satu outlet dengan target bulan berjalan, realisasi
mingguan, kekurangan, serta achievement-nya.

Periode yang sedang tampil: **Oktober 2026 (W40–W43)** — 4 produk (LM 600,
LM 1500+330, TPH, Nipis Madu) / 110 outlet, dari
`target_oct_toko_dan_simulasi.xlsx`.

> **Dua bentuk workbook, dua pembaca.** Sampai September file target berbentuk
> "POTENSI ..." dan dibaca `tools/build_data.py`. Mulai Oktober bentuknya
> "IKAT ..." — tiap sheet membawa tabel stratanya sendiri plus kolom zona,
> rate, dan cashback yang sudah dihitung kantor — dan dibaca
> `tools/build_ikat.py`. Keduanya menghasilkan `data.js` yang sama bentuknya.

> **Galon 15L tidak ada di file Oktober**, jadi produk itu hilang dari web.
> Kalau programnya jalan, file targetnya perlu dikirim terpisah.

> Hanya baris yang **ada nama salesman**-nya yang diambil; baris tanpa
> salesman dilewati dan jumlahnya dilaporkan saat build.

> **Koordinat outlet bersifat opsional.** Kalau workbook memuat satu sheet
> daftar outlet dengan kolom `KODEOUTLET`, `Latitude`, dan `Langitude`, isinya
> otomatis disambungkan ke outlet berdasarkan kode, dan panel detail
> menampilkan tautan ke Google Maps. Sheet itu dikenali dari judul kolomnya,
> bukan dari namanya, dan koordinat 0,0 dianggap belum dipetakan. Kalau sheet
> itu tidak ikut dikirim, koordinat yang sudah ada di `data.js` dipakai lagi —
> lokasi toko tidak berubah tiap bulan.

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

Aturan yang berbeda per program, semuanya dari surat program:

- **Nipis Madu** hanya membayar kalau ACH mencapai 100%. Program lain membayar
  mengikuti volume berapa pun yang masuk strata.
- **TPH** memakai dua tabel strata terpisah untuk outlet SO dan GROMIN.
- **LM 1500+330** tarifnya berbeda antara ukuran 1500ML dan 330ML; tarif
  gabungannya mengikuti komposisi omset outlet itu sendiri.

> **Strata itu minimum karton per minggu, bukan per bulan.** Itu sebabnya band
> bulanannya bergeser: September lima minggu, Oktober empat. Zona dihitung
> dari rata-rata mingguan omset, jadi tabel yang sama tetap benar tiap bulan
> tanpa ditulis ulang. Sejak Oktober tabel itu dibaca langsung dari sheetnya,
> jadi tidak perlu disalin ke kode sama sekali.

Untuk workbook bentuk "IKAT", cashback berjalan diambil apa adanya dari kolom
yang sudah dihitung kantor; yang dihitung sendiri hanya **cashback kalau
target tercapai** — angka yang tidak ada di file tetapi justru yang dicari
sales. Tarif model dicocokkan ke tarif yang tercetak di file setiap build; per
Oktober 23 baris bertarif, semuanya cocok.

Untuk workbook bentuk "POTENSI" yang lama, tabel strata ada di
`tools/cashback.py` dan diuji dengan `tools/uji_cashback.py`.

> Bonus triwulan Juli–September **belum** masuk web, karena hasil triwulannya
> memang belum keluar. Yang dihitung hanya bulan berjalan.

## Simulasi harga

Tombol **Simulasi Harga** di baris tampilan (sebelah Per Salesman / Per Rayon)
menjawab pertanyaan toko: *"kalau saya ambil segini, nett-nya jadi berapa?"*

Dasarnya dua sheet di workbook target, **SIMULASI NETT TPH OKT** dan
**SIMULASI NETT LM OKT**, yang disusun dari surat program. Dari situ web
mengambil price list, tangga DOF, tabel ikat target, dan bonusnya; rumusnya
persis yang ditulis di sheet itu:

| Program | Rumus nett akhir |
|---|---|
| TPH | PL − DOF − cashback/crt − bonus TPH350 /crt |
| LM 600 & LM 1500+330 | nett DOF − cashback/crt − bonus triwulan /crt |

Zona TPH dihitung dari total mix 350+500 sebulan; zona LM dari rata-rata
mingguan (qty bulan ÷ jumlah minggu). Isiannya mengikuti sheet: channel,
**jumlah minggu**, price list lama/baru, qty tiap SKU, qty LM lain untuk tier
DOF, status triwulan, serta syarat-syarat TPH (capai 100% target, W03 ≥ 70%,
syarat DOF Rp900).

> **Bulan 4 minggu vs 5 minggu.** Semua tabel ikat target sebenarnya menyebut
> minimum **per minggu**, jadi ambang bulanannya bergeser: Oktober–November 4
> minggu, Desember 5. Sheet simulasi menuliskan ambang TPH sudah dikali 4; di
> web ambang itu dikembalikan ke per minggu lalu dikali jumlah minggu yang
> dipilih, persis seperti sel "JML WEEK BULAN" di sheet LM. Pilihan 4/5 minggu
> ada di baris isian dan ikut mengubah zona TPH, LM, dan strata produk
> sekaligus — tarif, bonus, dan tangga DOF tidak ikut berubah, karena DOF
> dihitung dari akumulasi qty, bukan dari minggu.
>
> Hasil 5 minggu sudah dicocokkan dengan strata September (bulan 5 minggu yang
> datanya ada): TPH SO 5.000/12.500/25.000/35.000/50.000, LM 600
> 500/1.250/3.250/7.500/12.500, Nipis Madu 200/325/1.000/2.000/3.000 —
> semuanya sama dengan tabel resmi September.
>
> Bonus triwulan dihitung per karton bulan berjalan, jadi untuk satu triwulan
> penuh tiap bulan disimulasikan sendiri dengan jumlah minggunya masing-masing.

Hasilnya: nett akhir tiap ukuran sebagai angka besar, rincian lengkap, dua
tangga program (DOF dan ikat target) dengan baris yang sedang berlaku
disorot, dan kalimat tawaran:

> Tambah 6.000 crt (jadi 10.000 mix) → zona C, cashback Rp 1.100 /crt, bonus
> 30 crt TPH 350. Nett 350 jadi Rp 59.518.

Kalimat itu yang paling berguna di depan toko, karena **tarif zona baru
berlaku untuk seluruh volume, bukan cuma tambahannya**.

Yang perlu diperhatikan:

- **Angkanya diuji terhadap sheetnya sendiri.** Ketujuh baris contoh di dua
  sheet simulasi dipakai sebagai kunci jawaban; isian yang sama harus
  menghasilkan angka yang sama sampai rupiah terakhir.
- **Nipis Madu belum punya sheet simulasi**, jadi produk itu memakai simulasi
  sederhana: tangga strata cashback dengan harga jual diketik sendiri dan
  disimpan di peramban masing-masing. Kalau sheet simulasinya dibuat, produk
  itu ikut model yang sama dengan yang lain.
- **Tangga nett DOF LM berisi harga, bukan potongan**, dan tier yang lebih
  tinggi tidak boleh lebih mahal — dipakai harga termurah yang berlaku sampai
  qty itu.
- **Price list lama** dihitung dari price list baru dikurangi kenaikan yang
  tercantum di sheet (600 Rp1.000; 1500 & 330 Rp1.500).
- **Klik satu outlet → Simulasi harga** membuka simulasi dengan angka outlet
  itu: channel dari tipe outletnya, target sebagai qty, dan untuk LM 1500+330
  komposisi 1500/330 outlet itu sendiri.
- **Unduh CSV** saat tampilan simulasi aktif mengekspor hasil dan tangga
  programnya.

## Yang bisa dilakukan

- **Pilih produk** lewat tab di atas, atau **Semua Produk** untuk gabungannya.
- **Cari outlet** dengan mengetik nama outlet, nomor outlet, atau alamat. Bisa
  beberapa kata sekaligus, mis. `rifai agen` atau `2038524`.
- **Filter** salesman, rayon, zona, tipe outlet (SO / GROMIN / GROSIR), dasar
  target (MID / MAX — tiap outlet boleh memakai salah satunya),
  keterangan (FIX IKAT TARGET / POTENSI), dan status pencapaian (belum ada
  order, di bawah 50%, 50–99%, 100% ke atas). Isi tiap dropdown menyesuaikan
  filter lain, jadi tidak pernah menghasilkan daftar kosong; filter yang
  isinya cuma satu nilai ikut disembunyikan.
- **Ringkasan** jumlah outlet, target, realisasi, kekurangan, dan achievement
  ikut berubah mengikuti filter yang aktif.
- **Rekap Per Salesman / Per Rayon** untuk melihat pencapaian tiap orang atau
  tiap rayon.
- **Simulasi Harga** untuk menghitung harga nett akhir setelah DOF, cashback,
  dan bonus pada volume berapa pun (lihat bagian di atas).
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

```bash
python3 web/tools/build_ikat.py target_oct_toko_dan_simulasi.xlsx   # bentuk "IKAT"
python3 web/tools/build_single.py                      # tulis ulang dist/ + docs/
```

Tiap ganti bulan, sesuaikan tiga baris di atas `build_ikat.py`: `PERIODE`,
`WEEK_LABELS`, dan `BULAN_PENDEK` (dipakai mencari kolom seperti
`TGT OKT (4 WK)` dan `CASHBACK (RP) OKT`). Sisanya — kolom identitas, kolom
angka, dan tabel strata — dicari sendiri lewat judulnya.

Workbook bentuk "POTENSI" yang lama tetap bisa dibaca:

```bash
python3 web/tools/build_data.py target.xlsx [--monitoring form_monitoring.xlsx]
python3 web/tools/refresh_monitoring.py MONITORING_....xlsx
```

Koordinat outlet disimpan terpisah di `web/koordinat.json` supaya tidak ikut
hilang saat daftar outlet berubah tiap bulan.

## Isi berkas

| Berkas | Isi |
|---|---|
| `index.html` | kerangka halaman |
| `styles.css` | tampilan, termasuk mode gelap dan tata letak HP |
| `app.js` | filter, pencarian, rekap, panel detail, ekspor CSV |
| `data.js` | data hasil ekspor Excel (dibuat otomatis) |
| `tools/build_ikat.py` | workbook "IKAT" (Oktober dst) → `data.js` |
| `tools/simulasi.py` | sheet "SIMULASI NETT ..." → price list, DOF, bonus |
| `tools/build_data.py` | workbook "POTENSI" (sampai September) → `data.js` |
| `koordinat.json` | koordinat outlet, lepas dari data bulanan |
| `tools/refresh_monitoring.py` | segarkan `data.js` dari form monitoring mingguan |
| `tools/cashback.py` | tabel strata dan aturan cashback tiap program |
| `tools/uji_cashback.py` | uji tabel strata terhadap form monitoring resmi |
| `tools/build_single.py` | gabung semuanya jadi satu berkas HTML + `docs/index.html` |
