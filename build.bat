@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node.js first: https://nodejs.org/
  pause
  exit /b 1
)

echo Building Judie installer...
call npm run installer
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete.
pause
