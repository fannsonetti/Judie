@echo off
setlocal
cd /d "%~dp0"
echo.
echo  build-pi.bat is only a hint file on Windows.
echo.
echo  Use build.bat instead — it builds Windows AND starts the
echo  Raspberry Pi GitHub Actions build.
echo.
echo  On the Pi itself: double-click "Build Judie" on the Desktop
echo  ^(after ./scripts/enable-pi-launchers.sh once^).
echo.
pause
