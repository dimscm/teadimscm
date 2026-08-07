#!/data/data/com.termux/files/usr/bin/bash
#
# Mengisi config.toml MoneyPrinterTurbo dengan nilai yang tepat untuk Termux,
# supaya tidak perlu mengedit TOML lewat nano di layar HP.
#
# Pakai:
#   bash teadimscm/scripts/termux-configure.sh <PEXELS_API_KEY>
#
set -euo pipefail

CONFIG="${HOME}/MoneyPrinterTurbo/config.toml"
PEXELS_KEY="${1:-}"

if [ -z "${PEXELS_KEY}" ]; then
  printf 'Pakai: bash %s <PEXELS_API_KEY>\n' "$0"
  printf 'Ambil key gratis di https://www.pexels.com/api/\n'
  exit 1
fi

if [ ! -f "${CONFIG}" ]; then
  printf 'config.toml tidak ditemukan di %s\n' "${CONFIG}"
  printf 'Jalankan termux-setup.sh lebih dulu.\n'
  exit 1
fi

FFMPEG_PATH="$(command -v ffmpeg)"

python - "${CONFIG}" "${FFMPEG_PATH}" "${PEXELS_KEY}" <<'PY'
import re
import shutil
import sys

path, ffmpeg_path, pexels_key = sys.argv[1], sys.argv[2], sys.argv[3]

shutil.copyfile(path, path + ".bak")
text = open(path, encoding="utf-8").read()

settings = {
    # Binary bawaan imageio-ffmpeg dikompilasi untuk glibc dan tidak jalan di
    # Android, jadi diarahkan ke ffmpeg milik Termux.
    "ffmpeg_path": f'ffmpeg_path = "{ffmpeg_path}"',
    # faster-whisper sengaja tidak dipasang; "edge" memakai timestamp dari TTS.
    "subtitle_provider": 'subtitle_provider = "edge"',
    # Aplikasi ada di HP yang sama, jadi server tidak perlu terbuka ke jaringan.
    "listen_host": 'listen_host = "127.0.0.1"',
    "listen_port": "listen_port = 8080",
    "pexels_api_keys": f'pexels_api_keys = ["{pexels_key}"]',
}

for key, replacement in settings.items():
    pattern = re.compile(rf"^[ \t]*#?[ \t]*{key}[ \t]*=.*$", re.MULTILINE)
    text, replaced = pattern.subn(replacement.replace("\\", "\\\\"), text, count=1)
    if replaced:
        print(f"  diubah      {key}")
        continue

    # Kunci tidak ada di berkas contoh: sisipkan tepat di bawah header [app].
    header = re.search(r"^\[app\][ \t]*$", text, re.MULTILINE)
    if not header:
        text = "[app]\n" + replacement + "\n" + text
    else:
        insert_at = header.end()
        text = text[:insert_at] + "\n" + replacement + text[insert_at:]
    print(f"  ditambahkan {key}")

open(path, "w", encoding="utf-8").write(text)
PY

printf '\nHasilnya:\n'
grep -E '^[ \t]*(ffmpeg_path|subtitle_provider|listen_host|listen_port|pexels_api_keys)[ \t]*=' "${CONFIG}" || true

cat <<EOF

Cadangan berkas lama ada di ${CONFIG}.bak

Menjalankan servernya:

  cd ${HOME}/MoneyPrinterTurbo
  source .venv/bin/activate
  termux-wake-lock
  python main.py

Biarkan Termux terbuka. Di aplikasi MoneyPrinter Mobile, isi alamat server
dengan http://127.0.0.1:8080 lalu tekan "Tes koneksi".

EOF
