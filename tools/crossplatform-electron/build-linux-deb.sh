#!/usr/bin/env bash
# Build a standards-based Linux installer in Linux itself. No postinstall scripts.
set -euo pipefail
arch="$1"
case "$arch" in arm64|x64) ;; *) echo "Usage: build-linux-deb.sh arm64|x64" >&2; exit 2;; esac
root="$(cd "$(dirname "$0")" && pwd)"
binary_arch="$arch"
package_arch="amd64"
if [[ "$arch" == arm64 ]]; then package_arch="arm64"; fi
source_dir="$root/dist/linux-$binary_arch/Challenger Hub Cross Platform Pilot-linux-$binary_arch"
target="$root/dist/linux-$binary_arch/ChallengerHubPilot12-linux-$binary_arch.deb"
test -x "$source_dir/ChallengerHubPilot12"
test -f "$source_dir/resources/runtime-preview12/desktop-manifest.json"
test ! -e "$target"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
install -d "$stage/DEBIAN" "$stage/opt/challenger-hub-pilot12" "$stage/usr/share/applications" "$stage/usr/share/icons/hicolor/256x256/apps"
cp -a "$source_dir/." "$stage/opt/challenger-hub-pilot12/"
# Packager creates private source folders; Debian-installed app dirs must be user-readable.
find "$stage/opt/challenger-hub-pilot12" -type d -exec chmod 755 {} +
chmod 4755 "$stage/opt/challenger-hub-pilot12/chrome-sandbox"
cp "$root/../../brand/orbit/export/orbit-app-256.png" "$stage/usr/share/icons/hicolor/256x256/apps/challenger-hub-pilot12.png"
cat > "$stage/DEBIAN/control" <<EOF
Package: challenger-hub-pilot12
Version: 4.0.0~preview12
Section: utils
Priority: optional
Architecture: $package_arch
Maintainer: VelvetOS Internal <noreply@example.invalid>
Depends: libgtk-3-0, libnss3, libatk-bridge2.0-0, libgbm1, libasound2t64 | libasound2
Description: Challenger Hub private cross-platform Preview 12
 Shared source-linked software catalog with OS-specific, approval-gated installation.
 This build is experimental and does not authorize Linux installer adapters.
EOF
cat > "$stage/usr/share/applications/challenger-hub-pilot12.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Challenger Hub (Pilot 12)
Comment=Independent software discovery and vetted installer management
Exec=/opt/challenger-hub-pilot12/ChallengerHubPilot12
Terminal=false
Icon=challenger-hub-pilot12
Categories=Utility;Development;
EOF
chmod 644 "$stage/DEBIAN/control" "$stage/usr/share/applications/challenger-hub-pilot12.desktop"
dpkg-deb --root-owner-group -Zgzip -z6 --build "$stage" "$target"
sha256sum "$target" > "$target.sha256"
dpkg-deb --field "$target" Package Version Architecture
dpkg-deb --contents "$target" | grep -F 'chrome-sandbox' | head -n 1
echo "CHALLENGER_LINUX_DEB_READY $target"
