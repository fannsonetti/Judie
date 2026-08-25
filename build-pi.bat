@echo off
setlocal

cd /d "%~dp0"

echo.
echo  Judie Raspberry Pi builds cannot run on Windows.
echo.
echo  Pi 3 needs a 32-bit Raspberry Pi OS build (armhf).
echo.
echo  On the Pi:
echo    1. git clone / copy this repo
echo    2. chmod +x scripts/build-pi.sh
echo    3. ./scripts/build-pi.sh
echo.
echo  That produces a .deb under:
echo    src-tauri/target/release/bundle/deb/
echo.
echo  Docs: docs/raspberry-pi.md
echo.
pause
