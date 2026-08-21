$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$key = Join-Path $root "src-tauri\keys\nova.key"
$passwordFile = Join-Path $root "src-tauri\keys\password"

if (-not (Test-Path $key)) {
  throw "Missing $key. Generate it with: npx tauri signer generate -w src-tauri/keys/nova.key --ci -f"
}

$env:CI = "true"
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -Raw -Path $key).Trim()
$env:TAURI_SIGNING_PRIVATE_KEY_PATH = (Resolve-Path $key).Path
if (Test-Path $passwordFile) {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (Get-Content -Raw -Path $passwordFile).Trim()
} else {
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
}

Set-Location $root
npx tauri build

$installer = Get-ChildItem -Path (Join-Path $root "src-tauri\target\release\bundle\nsis") -Filter "*-setup.exe" | Select-Object -First 1
if ($installer) {
  Write-Host "Installer: $($installer.FullName)"
}
