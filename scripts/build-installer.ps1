$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

# Local Windows builds stay unsigned (same as CI). Do not pass extra --config JSON:
# PowerShell + npx.cmd eats those quotes and the build crashes.
npx tauri build --bundles nsis --no-sign

$installer = Get-ChildItem -Path (Join-Path $root "src-tauri\target\release\bundle\nsis") -Filter "*-setup.exe" | Select-Object -First 1
if ($installer) {
  Write-Host "Installer: $($installer.FullName)"
}
