#!/usr/bin/env bash
# Install the latest Judie armhf .deb from GitHub onto Raspberry Pi OS Lite.
# Usage: curl -fsSL https://raw.githubusercontent.com/fannsonetti/Judie/main/scripts/install-pi.sh | bash
set -euo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "install-pi.sh must run on the Raspberry Pi (Linux)." >&2
  exit 1
fi

if ! command -v dpkg >/dev/null; then
  echo "dpkg not found. Install Raspberry Pi OS Lite 32-bit first." >&2
  exit 1
fi

ARCH="$(dpkg --print-architecture)"
if [[ "$ARCH" != "armhf" ]]; then
  echo "Judie Pi packages are 32-bit armhf. This host is ${ARCH}." >&2
  echo "Flash Raspberry Pi OS Lite 32-bit, or build here with ./scripts/build-pi.sh" >&2
  exit 1
fi

if ! command -v curl >/dev/null; then
  echo "curl is required." >&2
  exit 1
fi

API="https://api.github.com/repos/fannsonetti/Judie/releases/latest"
JSON="$(curl -fsSL -H 'Accept: application/vnd.github+json' -H 'User-Agent: Judie-install-pi' "$API")"

pick_url() {
  if command -v python3 >/dev/null; then
    printf '%s' "$JSON" | python3 -c '
import json, sys
rel = json.load(sys.stdin)
# Prefer the stable alias, then any *armhf*.deb
alias = None
versioned = None
for a in rel.get("assets") or []:
    n = (a.get("name") or "").lower()
    u = a.get("browser_download_url") or ""
    if not n.endswith(".deb") or "armhf" not in n:
        continue
    if n == "judie_armhf.deb":
        alias = u
    elif versioned is None:
        versioned = u
url = alias or versioned
if not url:
    sys.exit(1)
print(url)
'
  else
    printf '%s' "$JSON" | grep -oE 'https://[^"]*armhf[^"]*\.deb' | head -1
  fi
}

URL="$(pick_url || true)"
if [[ -z "${URL}" ]]; then
  echo "No armhf .deb on the latest GitHub release." >&2
  exit 1
fi

TMP="$(mktemp /tmp/judie-XXXXXX.deb)"
trap 'rm -f "$TMP"' EXIT
echo "Downloading ${URL}"
curl -fsSL -o "$TMP" "$URL"

sudo apt-get update -qq
sudo apt-get install -y "$TMP"
echo "Judie installed: $(dpkg-query -W -f '${Version}' judie 2>/dev/null || echo ok)"
echo "Reboot to start the systemd kiosk (judie.service on tty1)."
echo "Debug: sudo systemctl status judie && journalctl -u judie -b"
