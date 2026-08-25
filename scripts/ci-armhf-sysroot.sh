#!/usr/bin/env bash
# Cross-compile sysroot for armv7-unknown-linux-gnueabihf (32-bit) on an aarch64 CI runner.
set -euo pipefail

SYSROOT="${SYSROOT:-/opt/armhf}"

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  debootstrap qemu-user-static binfmt-support pkg-config \
  gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf \
  libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
  librsvg2-dev patchelf libssl-dev libxdo-dev

if [[ ! -d "$SYSROOT/usr/lib/arm-linux-gnueabihf" ]]; then
  sudo debootstrap --arch=armhf --variant=minbase bookworm "$SYSROOT" http://deb.debian.org/debian
  sudo chroot "$SYSROOT" apt-get update
  sudo DEBIAN_FRONTEND=noninteractive chroot "$SYSROOT" apt-get install -y \
    libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
    librsvg2-dev libssl-dev libxdo-dev pkg-config
fi

PKG_LIB="$SYSROOT/usr/lib/arm-linux-gnueabihf/pkgconfig"
PKG_SHARE="$SYSROOT/usr/share/pkgconfig"

export_line() {
  echo "$1"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "$1" >> "$GITHUB_ENV"
  fi
}

export_line "PKG_CONFIG_ALLOW_CROSS=1"
export_line "PKG_CONFIG_SYSROOT_DIR=$SYSROOT"
export_line "PKG_CONFIG_LIBDIR=$PKG_LIB:$PKG_SHARE"
export_line "PKG_CONFIG_PATH=$PKG_LIB:$PKG_SHARE"
export_line "CFLAGS=--sysroot=$SYSROOT"
export_line "CXXFLAGS=--sysroot=$SYSROOT"
export_line "CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABIHF_LINKER=arm-linux-gnueabihf-gcc"
export_line "CC_armv7_unknown_linux_gnueabihf=arm-linux-gnueabihf-gcc"
export_line "CXX_armv7_unknown_linux_gnueabihf=arm-linux-gnueabihf-g++"
