#!/data/data/com.termux/files/usr/bin/bash
#
# Menyiapkan API MoneyPrinterTurbo di dalam Termux, supaya aplikasi Android ini
# bisa memakai HP-nya sendiri sebagai server render.
#
# BELUM PERNAH DIUJI. Ditulis dari pembacaan kode MoneyPrinterTurbo, bukan dari
# menjalankannya di perangkat Android sungguhan. Kalau ada langkah yang gagal,
# kirimkan pesan errornya.
#
# Pakai:
#   pkg install git
#   git clone https://github.com/dimscm/teadimscm.git
#   bash teadimscm/scripts/termux-setup.sh
#
set -euo pipefail

REPO_URL="https://github.com/harry0703/MoneyPrinterTurbo.git"
TARGET_DIR="${HOME}/MoneyPrinterTurbo"

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }
warn() { printf '\n\033[1;33m!!! %s\033[0m\n' "$1"; }

if [ ! -d "/data/data/com.termux" ]; then
  warn "Skrip ini untuk dijalankan di dalam Termux."
  exit 1
fi

say "Memperbarui daftar paket"
pkg update -y
pkg upgrade -y

# Dipasang satu per satu, bukan sekaligus: kalau satu nama paket tidak ada di
# repositori Termux, pemasangan borongan akan gagal seluruhnya dan menyeret yang
# lain ikut batal.
install_required() {
  for package in "$@"; do
    say "Memasang ${package}"
    pkg install -y "${package}"
  done
}

install_optional() {
  for package in "$@"; do
    if pkg install -y "${package}"; then
      printf '    %s terpasang\n' "${package}"
    else
      warn "${package} tidak tersedia, dilewati"
    fi
  done
}

# ffmpeg dari Termux menggantikan binary bawaan imageio-ffmpeg, yang dikompilasi
# untuk glibc dan tidak jalan di Android.
# rust dan clang dibutuhkan karena pydantic-core dan jiter tidak punya wheel
# siap pakai untuk Android, jadi keduanya dibangun dari sumber.
say "Memasang paket wajib"
install_required python git ffmpeg rust clang make

say "Memasang paket pendukung"
install_optional binutils pkg-config libjpeg-turbo libpng freetype littlecms openssl

# numpy dan pillow lewat pkg kalau ada: keduanya punya ekstensi C yang kalau
# dibangun dari sumber di HP itu lambat dan gampang gagal. Kalau paketnya tidak
# ada, pip yang menanganinya nanti.
say "Mencoba memasang numpy dan pillow dari paket Termux"
install_optional python-numpy python-pillow

if [ -d "${TARGET_DIR}" ]; then
  say "MoneyPrinterTurbo sudah ada, mengambil pembaruan"
  git -C "${TARGET_DIR}" pull --ff-only || warn "git pull dilewati"
else
  say "Mengunduh MoneyPrinterTurbo"
  git clone --depth 1 "${REPO_URL}" "${TARGET_DIR}"
fi

cd "${TARGET_DIR}"

# --system-site-packages supaya numpy dan pillow dari pkg tetap terlihat.
say "Membuat virtualenv"
python -m venv --system-site-packages .venv
# shellcheck disable=SC1091
source .venv/bin/activate

# Daftar ini sengaja lebih pendek daripada requirements.txt bawaan. Yang dibuang
# hanya dependency yang di-import secara lazy atau tidak dipakai oleh API:
#
#   streamlit          -> hanya untuk WebUI; menarik pyarrow yang tidak punya
#                         wheel Android dan sangat berat dibangun dari sumber.
#   faster-whisper     -> di app/services/subtitle.py di-import dalam try/except
#                         ImportError, jadi aman absen selama subtitle_provider
#                         diisi "edge". Menarik ctranslate2 (binary C++).
#   azure-cognitive... -> di-import di dalam fungsi azure_tts_v2(). SDK-nya
#                         binary tertutup dan tidak punya build Android.
#   litellm / dashscope / google-genai
#                      -> di-import di dalam cabang provider masing-masing di
#                         app/services/llm.py. Tidak perlu kalau naskah ditulis
#                         dari aplikasi Android dengan API key sendiri, atau
#                         lewat provider yang kompatibel OpenAI.
say "Memasang dependency Python (pydantic-core dan jiter dibangun dari sumber, sabar)"
cat > requirements-termux.txt <<'REQS'
moviepy==2.2.1
edge_tts==7.2.7
fastapi==0.136.3
uvicorn==0.32.1
openai==2.24.0
loguru==0.7.3
redis==5.2.0
# Dipakai app/config/config.py tapi tidak tercantum di requirements.txt bawaan:
# selama ini ikut terbawa sebagai dependency streamlit, yang di sini dibuang.
toml==0.10.2
python-multipart==0.0.27
pyyaml==6.0.3
requests==2.33.1
packaging==24.2
socksio==1.0.0
pydub==0.25.1
audioop-lts==0.2.2; python_version >= "3.13"
REQS

pip install --upgrade pip wheel setuptools

# numpy dan pillow ikut di sini hanya kalau paket Termux-nya tadi tidak terpasang.
python - <<'PY' >> requirements-termux.txt
import importlib.util
for module, requirement in (("numpy", "numpy"), ("PIL", "pillow")):
    if importlib.util.find_spec(module) is None:
        print(requirement)
PY

pip install -r requirements-termux.txt

say "Memeriksa apakah paket intinya benar-benar bisa dimuat"
python - <<'PY'
import sys

failed = []
for module in ("numpy", "PIL", "moviepy", "edge_tts", "fastapi", "uvicorn", "openai", "pydub"):
    try:
        __import__(module)
    except Exception as error:
        failed.append(f"{module}: {error}")

if failed:
    print("\nModul yang gagal dimuat:")
    for line in failed:
        print("  -", line)
    print("\nKirimkan daftar di atas supaya bisa diperbaiki.")
    sys.exit(1)

print("Semua modul inti berhasil dimuat.")
PY

if [ ! -f config.toml ]; then
  say "Membuat config.toml"
  cp config.example.toml config.toml
fi

say "Selesai memasang"

cat <<EOF

Sekarang buka config.toml dan sesuaikan empat hal berikut:

  [app]
  ffmpeg_path = "$(command -v ffmpeg)"
  subtitle_provider = "edge"      # jangan "whisper" — faster-whisper tidak dipasang
  pexels_api_keys = ["..."]       # ambil gratis di https://www.pexels.com/api/
  listen_host = "127.0.0.1"       # aplikasi ada di HP yang sama, tidak perlu dibuka keluar

Edit dengan:  nano ${TARGET_DIR}/config.toml

Menjalankan servernya:

  cd ${TARGET_DIR}
  source .venv/bin/activate
  termux-wake-lock          # supaya Android tidak mematikan proses saat layar mati
  python main.py

Di aplikasi MoneyPrinter Mobile, isi alamat server dengan:

  http://127.0.0.1:8080

Catatan khusus HyperOS/MIUI: buka Setelan > Aplikasi > Termux, matikan
pembatasan baterainya dan kunci Termux di daftar aplikasi terkini. Tanpa itu
Android kemungkinan besar akan mematikan proses render di tengah jalan.

EOF
