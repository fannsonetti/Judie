@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js first: https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing npm packages...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Building Judie for Windows...
echo This is an unsigned NSIS installer so you can run it locally.
call npx tauri build --bundles nsis --no-sign
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete. Installer is under src-tauri\target\release\bundle\nsis\
pause
