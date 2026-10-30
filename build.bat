@echo off
setlocal EnableExtensions

cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js first: https://nodejs.org/
  pause
  exit /b 1
)

echo ========================================
echo  1/2  Windows installer
echo ========================================
call npm run installer
if errorlevel 1 (
  echo.
  echo Windows build failed.
  pause
  exit /b 1
)

echo.
echo Windows installer:
echo   src-tauri\target\release\bundle\nsis\
echo.

echo ========================================
echo  2/2  Raspberry Pi (aarch64^)
echo ========================================
echo Pi binaries cannot be compiled on Windows directly.
echo Triggering GitHub Actions ARM build...
echo.

where gh >nul 2>&1
if errorlevel 1 (
  echo GitHub CLI ^(gh^) not found — Pi build was NOT started.
  echo.
  echo Install: https://cli.github.com/
  echo Then:    gh auth login
  echo Or on the Pi double-click "Build Judie".
  echo Or push a version tag to run the Release workflow.
  echo.
  pause
  exit /b 0
)

gh auth status >nul 2>&1
if errorlevel 1 (
  echo gh is installed but not logged in. Run: gh auth login
  echo.
  pause
  exit /b 0
)

git push origin HEAD >nul 2>&1

gh workflow run build-pi.yml
if errorlevel 1 (
  echo.
  echo Could not start the Pi workflow. Push this repo to GitHub first,
  echo and ensure .github/workflows/build-pi.yml is on the default branch.
  echo.
  echo On the Pi you can still double-click "Build Judie".
  pause
  exit /b 0
)

echo.
echo Raspberry Pi build started on GitHub Actions.
echo   Open:  https://github.com/fannsonetti/Nova/actions
echo   When it finishes: Actions -^> Build Raspberry Pi -^> Artifacts
echo   Download: judie-raspberry-pi-aarch64  ^(.deb + AppImage^)
echo.
echo Copy the .deb to the Pi and install with:
echo   sudo apt install -y ./judie_*.deb
echo.
echo Build complete ^(Windows local + Pi on Actions^).
pause
