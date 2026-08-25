#!/usr/bin/env bash
# Cross-compile sysroot for armv7-unknown-linux-gnueabihf (32-bit) on an aarch64 CI runner.
# Bookworm glibc is intentional: Ubuntu 24.04 armhf libs would not run on Raspberry Pi OS.
set -euo pipefail

SYSROOT="${SYSROOT:-/opt/armhf}"

sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  debootstrap qemu-user-static binfmt-support pkg-config \
  gcc-arm-linux-gnueabihf g++-arm-linux-gnueabihf \
  libx11-dev libxcb1-dev libxkbcommon-dev libfontconfig1-dev libfreetype6-dev \
  patchelf symlinks

if [[ ! -d "$SYSROOT/usr/lib/arm-linux-gnueabihf" ]]; then
  sudo debootstrap --arch=armhf --variant=minbase bookworm "$SYSROOT" http://deb.debian.org/debian
fi

sudo chroot "$SYSROOT" apt-get update
# Always install (idempotent) so new deps land even if the sysroot dir already exists.
sudo DEBIAN_FRONTEND=noninteractive chroot "$SYSROOT" apt-get install -y \
  libc6-dev \
  libx11-dev libxcb1-dev libxkbcommon-dev libfontconfig1-dev libfreetype6-dev \
  pkg-config

# Debootstrap writes absolute symlinks (/lib/...). The cross-linker follows them
# onto the host filesystem unless they are rewritten relative to the sysroot.
if command -v symlinks >/dev/null 2>&1; then
  sudo symlinks -cr "$SYSROOT" >/dev/null || true
fi

PKG_LIB="$SYSROOT/usr/lib/arm-linux-gnueabihf/pkgconfig"
PKG_SHARE="$SYSROOT/usr/share/pkgconfig"
RUSTFLAGS="-C link-arg=--sysroot=$SYSROOT"

export_line() {
  echo "$1"
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "$1" >> "$GITHUB_ENV"
  fi
}

export_line "PKG_CONFIG_ALLOW_CROSS=1"
export_line "PKG_CONFIG_ALLOW_SYSTEM_CFLAGS=1"
export_line "PKG_CONFIG_ALLOW_SYSTEM_LIBS=1"
export_line "PKG_CONFIG_SYSROOT_DIR=$SYSROOT"
export_line "PKG_CONFIG_LIBDIR=$PKG_LIB:$PKG_SHARE"
export_line "PKG_CONFIG_PATH=$PKG_LIB:$PKG_SHARE"
export_line "CFLAGS=--sysroot=$SYSROOT"
export_line "CXXFLAGS=--sysroot=$SYSROOT"
export_line "CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABIHF_LINKER=arm-linux-gnueabihf-gcc"
export_line "CC_armv7_unknown_linux_gnueabihf=arm-linux-gnueabihf-gcc"
export_line "CXX_armv7_unknown_linux_gnueabihf=arm-linux-gnueabihf-g++"
export_line "BINDGEN_EXTRA_CLANG_ARGS_armv7_unknown_linux_gnueabihf=--sysroot=$SYSROOT"
export_line "CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABIHF_RUSTFLAGS=$RUSTFLAGS"
