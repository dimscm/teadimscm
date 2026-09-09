# Peta Potensi NOO

Web untuk sales: **masukkan file Excel POTENSI NOO, peta langsung jadi.** Tidak ada langkah Python,
tidak ada CMD, tidak ada file data yang diunggah ke mana pun — seluruh pengolahan berjalan di dalam
browser yang membuka web ini.

Isinya menjawab satu pertanyaan lapangan: *saya berdiri di titik ini, toko apa saja di sekitar saya,
punya siapa, omzetnya berapa, dan mana yang belum digarap divisi saya.*

## Apa yang dikerjakan web ini saat file dimasukkan

Semua ini jalan di browser, di dalam Web Worker, sekitar 2–4 detik untuk 56.000 baris:

1. **Membaca .xlsx** — pembaca XLSX kecil bawaan (`src/lib/xlsx.ts`), tanpa pustaka besar.
2. **Menentukan divisi** dari awalan kolom `SALESMAN BEFORE` (`M3-…` → M3, `M1/M2/M4` → MUH,
   `MU/MT/CNS` → MU, dst). Baris `(BLANK)` dihitung sebagai tanpa divisi, bukan dibuang.
3. **Membuang koordinat mustahil** — titik yang jaraknya lebih dari 75 km dari pusat data sendiri
   (biasanya salah ketik; di file terakhir ada 22 titik seperti ini).
4. **Melengkapi koordinat kosong** — baris tanpa titik meminjam titik dari baris bernama sama di
   kelurahan yang sama, **hanya kalau** para pendonornya sendiri berkumpul dalam radius 150 m. Kalau
   tiga toko "ITA" tersebar di tiga tempat, tidak ada yang dipinjamkan.
5. **Menghitung jarak ke divisi terdekat** untuk setiap baris (dibatasi 300 m).
6. **Menggabungkan toko yang sama** walau namanya berbeda — lihat di bawah.

Hasilnya disimpan di IndexedDB perangkat itu, jadi kalau web dibuka lagi besok, tidak perlu memasukkan
Excel ulang.

## "Maps mirip, nama berbeda, berarti tokonya sama"

Satu toko fisik sering terdaftar beberapa kali dengan nama berbeda di tiap divisi. Contoh nyata dari
file terakhir — ketiganya berdiri di titik yang sama:

```
EKO* (CWC)    CWC   -6.119189, 106.909576
EKO* (M1)     BIS   -6.119098, 106.909157
GUNAWAN       MU    -6.119112, 106.909637
```

Penggabungan memakai dua rambu supaya tidak kebablasan:

- **Divisi yang sama + nama berbeda = toko berbeda.** Satu divisi tidak mendaftarkan satu toko dua
  kali dengan dua nama; kalau dua baris sama-sama BIS tapi namanya beda, itu dua kios bersebelahan.
  Tanpa rambu ini, satu deretan kios di pasar akan menyatu jadi satu "toko" raksasa.
- **Sebaran dibatasi.** Satu kelompok tidak boleh melebar lebih dari 45 m dari pusatnya sendiri.

Di file terakhir: 56.845 baris → **20.043 toko fisik**, 6.950 di antaranya dilayani ≥2 divisi, dan
**8.131 toko belum digarap M3** (Rp 42,3 M omzet 26 minggu).

Satu toko dihitung sudah digarap kalau **salah satu** pendaftarannya sudah dilayani divisi itu —
aturan yang sama dipakai peta, angka di panel kiri, dan file ekspor, supaya ketiganya tidak pernah
berbeda.

## Tampilan sederhana (bawaan)

Web ini terbuka dalam mode sederhana: satu pertanyaan, satu jawaban.

1. **Divisi saya** — pilih satu divisi. Tiap tombol langsung menunjukkan berapa toko yang belum
   digarapnya.
2. **Lihat yang belum digarap** — toko yang belum disentuh divisi itu diberi **pin oranye bertanda
   `!`**; toko yang sudah digarap jadi titik abu-abu kecil. Ada satu centang untuk menyembunyikan
   yang sudah digarap.
3. **Persempit wilayah** — pencarian nama toko dan pilihan kecamatan.

Lalu kotak **Hasil** menampilkan angkanya besar-besar dan tombol ekspor.

Petanya bertingkat supaya tidak bikin pusing: dari jauh tiap gerombolan tampil sebagai bulatan putih
berisi jumlah toko dengan **angka oranye kecil** untuk yang belum digarap — jadi mata langsung tertuju
ke angka oranye terbesar. Diperbesar, gerombolan berganti jadi bulatan oranye seukuran jumlah
peluangnya, lalu akhirnya jadi pin `!` per toko.

Semua penyaring lain ada di balik tombol **Buka filter lanjutan**.

## Warna, tanda, dan ekspor (mode lanjutan)

- **Warna titik bisa diganti artinya** lewat tombol di atas peta:
  - *Divisi* — tiap divisi punya warnanya sendiri (BIS biru, CWC cokelat, MUH toska, MU magenta,
    M3 ungu). Gerombolan titik ikut diwarnai divisi terbanyak di dalamnya, dengan gelang di
    sekelilingnya yang menunjukkan komposisinya. Diperbesar, tiap titik memunculkan huruf divisinya
    (B/C/H/M/3) — warna saja tidak cukup untuk lima divisi, apalagi bagi yang buta warna.
  - *Status* — oranye untuk toko yang belum digarap divisi yang ditandai, abu-abu untuk yang sudah.
  - *Omzet* — makin gelap, makin besar omzet tokonya.
- **Menandai peluang bisa lebih dari satu divisi.** Kalau BIS dan M3 dipilih bersamaan, yang ditandai
  hanya toko yang belum digarap keduanya. Setiap divisi menampilkan jumlah tokonya sendiri, dan
  divisi tanpa koordinat (MUH) dimatikan supaya tidak memberi angka palsu.
- **Penyaring di panel kiri** (semua bisa dipakai bersamaan):
  - *Tampilkan divisi* — hanya divisi tertentu, dengan jumlah outletnya.
  - *Sudah digarap minimal* — Semua / ≥2 / ≥3 / ≥4 divisi. Toko yang sudah dipercaya beberapa divisi
    biasanya paling layak digarap divisi berikutnya.
  - *Radius toleransi* — sebuah divisi dianggap sudah menggarap toko bila punya outlet dalam radius
    ini, atau punya toko bernama sama di kelurahan yang sama. Mengubahnya langsung mengubah semua
    angka “belum digarap”.
  - *Channel, Kecamatan, Kelurahan, Salesman* — daftar centang yang bisa dicari, lengkap dengan
    jumlah outlet per pilihan. Kelurahan otomatis mengikuti kecamatan yang dipilih.
  - *Omzet 26 minggu* — Semua / ≥250 rb / ≥1 jt / ≥5 jt.
  - *Tampilan* — gabungkan toko yang sama, ikutkan baris tanpa koordinat, dan saring toko yang sudah
    atau belum dilaporkan sales.
- **Zoom ke hasil** di atas peta memperbesar peta ke outlet yang sedang lolos filter.
- **Ekspor** ada di kotak *Hasil* di panel kiri. Yang keluar adalah file **Excel (.xlsx)** berisi
  persis daftar yang sedang tampil, dengan kolom `DIVISI YANG SUDAH MASUK`, `DIVISI YANG BELUM`,
  `DITANDAI PELUANG`, `NAMA TOKO INI DI DIVISI LAIN` (bukti bahwa baris-baris itu satu toko fisik
  walau namanya berbeda), dan `LINK MAPS` yang **tinggal diklik** — CSV tidak bisa menyimpan link
  yang bisa diklik, jadi file .xlsx-nya ditulis sendiri oleh web ini (`src/lib/xlsx-write.ts`), pakai
  hyperlink asli, baris judul yang dibekukan, dan filter kolom. Tautan "atau unduh CSV biasa" tetap
  ada untuk yang butuh CSV.
- **Panel kiri dan kanan bisa dilipat** lewat dua tombol di kanan atas, supaya peta memakai seluruh
  layar. Pilihannya diingat sampai kunjungan berikutnya, dan tombol **Filter** tetap muncul saat
  panel kiri disembunyikan.

## Cara pakai (sales)

1. Buka alamat webnya, login lewat Cloudflare Access.
2. Masukkan file Excel yang dikirim kantor (sekali saja per HP).
3. Tekan **Lokasi saya**, atau ketuk satu titik di peta → daftar outlet terdekat muncul: nama, sales
   pemegang, omzet, dan divisi mana saja yang sudah masuk.
4. Titik berlingkaran oranye = toko yang sudah dilayani divisi lain tapi **belum** divisi yang
   ditandai (standar: M3). Semua titik lain tetap tampil — tanda tidak menyembunyikan apa pun,
   kecuali kalau *Sembunyikan toko lainnya* dicentang.
5. Buka toko → **Rute ke sini** untuk dibuka di Google Maps.
6. Sesudah berkunjung, isi **Laporan kunjungan**: status, toko selama ini beli dari mana, dan catatan.
7. Kantor mengambil laporannya dari tab **Ringkasan → Unduh laporan survey** (CSV, langsung terbuka
   di Excel).

Huruf di dalam titik menandai divisi (B/C/H/M/3) — warna saja tidak cukup untuk lima divisi, apalagi
bagi yang buta warna, jadi hurufnya wajib ada. Perbesar peta untuk melihatnya.

## Menjalankan di komputer sendiri

```bash
npm install
npm run dev      # buka http://localhost:5173
npm run build    # hasil siap unggah ada di dist/
```

## Deploy (Cloudflare Pages)

Klik dua kali **`deploy.cmd`** di Windows, atau:

```bash
npm run build
npx wrangler@4 pages deploy dist --project-name potensi-noo
```

Situsnya tetap dilindungi Cloudflare Access seperti sebelumnya. Yang berubah: **tidak ada lagi file
data yang ikut diunggah** — `dist/` hanya berisi kode, dan setiap orang memasukkan Excel-nya sendiri.
Itu sebabnya repo ini aman untuk publik.

### Opsional: kirim laporan survey langsung ke database

Web ini jalan penuh tanpa server. Kalau ingin laporan sales masuk ke database pusat, ada Pages
Function di `functions/api/visits.ts` yang siap dipakai:

```bash
npx wrangler@4 d1 create potensi-noo
npx wrangler@4 d1 execute potensi-noo --remote --file=schema.sql
```

Lalu tambahkan blok ini ke `wrangler.json` (pakai `database_id` yang keluar dari perintah pertama):

```json
"d1_databases": [
  { "binding": "DB", "database_name": "potensi-noo", "database_id": "ID-YANG-KELUAR-TADI" }
]
```

dan daftar admin lewat secret — **jangan** ditulis di file, karena repo ini publik:

```bash
npx wrangler@4 pages secret put ADMIN_EMAILS --project-name potensi-noo
```

Identitas penulis laporan diambil dari header Cloudflare Access, bukan dari isi permintaan, jadi tidak
bisa dipalsukan dari browser. Tanpa daftar admin, tidak ada yang jadi admin. Kalau database belum
dipasang, endpoint menjawab 503 dan aplikasi diam-diam berhenti mengirim — laporan tetap tersimpan di
HP dan tetap bisa diunduh sebagai CSV.

## Yang tidak boleh masuk repo

`.gitignore` memblokir `*.xlsx`, `*.xls`, dan `*.csv`. Master data (alamat, koordinat, omzet per toko,
nama salesman) tidak pernah dikomit — di repo publik, menghapusnya di komit berikutnya pun tidak
menolong karena masih bisa diambil dari riwayat.
