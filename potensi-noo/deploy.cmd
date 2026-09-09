@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Peta Potensi NOO - build ^& deploy
echo ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js belum terpasang.
  echo     Pasang dulu dari https://nodejs.org ^(pilih versi LTS^), lalu jalankan file ini lagi.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [1/3] Memasang komponen ^(sekali saja, agak lama^)...
  call npm install || goto :failed
) else (
  echo [1/3] Komponen sudah terpasang.
)

echo [2/3] Membangun aplikasi...
call npm run build || goto :failed

echo [3/3] Mengunggah ke Cloudflare Pages...
call npx wrangler@4 pages deploy dist --project-name potensi-noo || goto :failed

echo.
echo Selesai. Buka alamat yang tertulis di atas.
echo File Excel TIDAK ikut terunggah - sales memasukkannya sendiri lewat web.
pause
exit /b 0

:failed
echo.
echo Gagal. Salin pesan merah di atas kalau perlu bantuan.
pause
exit /b 1
