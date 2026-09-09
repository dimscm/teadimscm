> **Isi repositori ini:** `potensi-noo/` — web Peta Potensi NOO (masukkan Excel, peta jadi
> otomatis); sisanya adalah MoneyPrinter Mobile di bawah ini.

# MoneyPrinter Mobile

Aplikasi Android (Kotlin + Jetpack Compose) untuk mengendalikan
[MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) dari HP: tulis topik, biarkan
AI menyusun naskah, kirim job render ke server sendiri, pantau progresnya, lalu putar dan unduh
hasilnya.

> Render video butuh ffmpeg, moviepy, dan CPU/RAM besar — itu tidak bisa dijalankan di HP.
> Aplikasi ini adalah **klien** untuk instance MoneyPrinterTurbo milikmu sendiri (LAN, VPS,
> Docker, Colab — bebas). Bagian AI-nya bisa jalan di server **atau** langsung dari HP dengan API
> key yang kamu ketik sendiri.

## Fitur

- **Buat video** — topik, naskah, kata kunci, plus seluruh parameter `VideoParams` milik
  MoneyPrinterTurbo: rasio (9:16 / 16:9 / 1:1), sumber footage (Pexels, Pixabay, Coverr, lokal),
  urutan klip, transisi, durasi & kecepatan klip, jumlah video, suara edge-TTS, volume/kecepatan
  bicara, musik latar, subtitle (posisi, font, ukuran, warna, garis tepi, latar), dan jumlah thread.
- **Otak AI, dua mode**
  - *Pakai AI di server* — memakai `/api/v1/scripts` dan `/api/v1/terms`, jadi key LLM cukup ada di
    `config.toml` server.
  - *Pakai API key sendiri* — aplikasi memanggil provider langsung dari HP, lalu mengirim naskah
    jadi ke server. Server tidak perlu punya key LLM sama sekali. Provider yang didukung: OpenAI,
    Google Gemini, DeepSeek, Moonshot/Kimi, Qwen, Groq, xAI Grok, OpenRouter, Ollama, dan apa pun
    yang kompatibel OpenAI (OneAPI, LiteLLM, AIHubMix, ModelScope, …).
- **Daftar tugas** — status, progres real-time, hapus tugas.
- **Detail tugas** — pemutar video bawaan (Media3/ExoPlayer, streaming langsung dari server),
  unduh ke `Movies/MoneyPrinter`, bagikan tautan.
- **Progres di background** — foreground service menampilkan progres render di status bar dan
  memberi notifikasi saat video selesai atau gagal.
- Antarmuka Indonesia + Inggris, tema terang/gelap, Material 3 (dynamic color di Android 12+).

## Keamanan API key

API key server (`x-api-key`) dan API key LLM disimpan terenkripsi AES-256-GCM dengan kunci
non-extractable dari Android Keystore (`SecretStore.kt`). Yang tersimpan di `SharedPreferences`
hanya ciphertext. Key LLM tidak pernah dikirim ke server MoneyPrinterTurbo.

## Menyiapkan server

Jalankan MoneyPrinterTurbo seperti biasa, lalu pastikan API-nya bisa diakses dari HP:

```toml
# config.toml
[app]
listen_host = "0.0.0.0"   # bukan 127.0.0.1, supaya bisa diakses dari HP
listen_port = 8080
api_key = "rahasia-panjang"  # opsional, tapi wajib kalau server terbuka ke internet

# Agar URL video di respons API bisa dibuka HP, isi endpoint dengan alamat yang sama:
endpoint = "http://192.168.1.10:8080"
```

```bash
python main.py      # API di http://<ip-server>:8080, dokumentasi di /docs
```

Di aplikasi: **Pengaturan → Server**, isi `http://192.168.1.10:8080` dan API key (kosongkan kalau
`api_key` tidak diisi di server), lalu tekan **Tes koneksi**.

## Build

Butuh JDK 17 dan Android SDK (compileSdk 35). Buat `local.properties` yang menunjuk ke SDK, atau
set `ANDROID_HOME`.

```bash
./gradlew assembleDebug          # APK di app/build/outputs/apk/debug/
./gradlew installDebug           # pasang ke perangkat yang tersambung
```

Buka juga langsung di Android Studio (Ladybug atau lebih baru).

| | |
|---|---|
| minSdk | 26 (Android 8.0) |
| targetSdk / compileSdk | 35 |
| Bahasa/UI | Kotlin 2.0, Jetpack Compose, Material 3 |
| Jaringan | Retrofit + OkHttp + kotlinx.serialization |
| Pemutar | Media3 ExoPlayer |

Traffic HTTP polos diizinkan lewat `network_security_config.xml` karena instance self-hosted
umumnya berjalan di `http://` dalam jaringan lokal. Kalau servermu memakai HTTPS dengan sertifikat
sendiri, sertifikat CA yang dipasang user juga sudah dipercaya.

## Catatan

- Nama model default per provider (mis. `gpt-4o-mini`, `gemini-2.5-flash`) hanya isian awal dan
  bisa diganti di **Pengaturan → AI**.
- Daftar suara memakai format edge-TTS `locale-NamaVoice-Gender` seperti yang dipakai
  MoneyPrinterTurbo, dan kolomnya tetap bisa diketik manual untuk suara lain.
- Nama font mengacu ke berkas di `resource/fonts` pada server, bukan font di HP.
