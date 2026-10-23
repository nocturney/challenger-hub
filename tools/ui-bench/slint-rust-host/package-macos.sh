#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "macOS packaging must run on a Mac" >&2; exit 1
fi
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
runtime="$repo/tools/desktop-build/dist/runtime-preview12"
seed="$repo/tools/desktop-build/seeds/catalog-candidates.preview10.json"
test -f "$runtime/desktop-manifest.json"
test -f "$seed"
node_bin="$(command -v node)"
test -x "$node_bin"
export PATH="$HOME/.cargo/bin:$PATH"
cargo build --manifest-path "$here/Cargo.toml" --release --locked
cargo_target="${CARGO_TARGET_DIR:-$here/target}"
app="$here/dist/ChallengerHubNativePreview.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$cargo_target/release/challenger-slint-rust-host" "$app/Contents/MacOS/"
# Do not ship a huge universal Node when this preview targets one Mac arch.
if [[ "$(/usr/bin/lipo -archs "$node_bin" | wc -w | tr -d ' ')" -gt 1 ]]; then
  /usr/bin/lipo -thin "$(uname -m)" "$node_bin" -output "$app/Contents/Resources/node"
else
  cp "$node_bin" "$app/Contents/Resources/node"
fi
chmod 755 "$app/Contents/MacOS/challenger-slint-rust-host" "$app/Contents/Resources/node"
cp "$here/../slint-node-bridge/sidecar.mjs" "$app/Contents/Resources/"
cp "$here/../slint-node-bridge/live-catalog.mjs" "$app/Contents/Resources/"
cp "$seed" "$app/Contents/Resources/catalog-candidates.preview10.json"
cp -R "$runtime" "$app/Contents/Resources/runtime-preview12"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>CFBundleIdentifier</key><string>com.velvet.challenger.native-preview</string>
    <key>CFBundleName</key><string>Challenger Native Preview</string>
    <key>CFBundleExecutable</key><string>challenger-slint-rust-host</string>
    <key>CFBundlePackageType</key><string>APPL</string>
    <key>CFBundleShortVersionString</key><string>0.1.0</string>
    <key>CFBundleVersion</key><string>1</string>
    <key>NSHighResolutionCapable</key><true/>
  </dict>
</plist>
PLIST
for bin in "$app/Contents/MacOS/challenger-slint-rust-host" "$app/Contents/Resources/node"; do
  if otool -L "$bin" | grep -E '/opt/homebrew/|/usr/local/lib/|libintl[.]8' ; then
    echo "Nonredistributable dynamic dependency in $bin" >&2; exit 2
  fi
done
/usr/bin/codesign --force --deep --sign - "$app"
echo "MAC_NATIVE_PACKAGE_PASS $app"
echo "Run for live backend QA: $app/Contents/MacOS/challenger-slint-rust-host --check-backend-only"
