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
# The bundled Node runtime must be the reviewed, patched LTS release.
# Fail closed instead of silently copying an older system executable.
required_node_version="v24.22.1"
node_version="$("$node_bin" --version)"
if [[ "$node_version" != "$required_node_version" ]]; then
  echo "Refusing unpatched/unreviewed Node: expected $required_node_version, found $node_version" >&2; exit 3
fi
case "$(uname -m)" in
  arm64) expected_node_arch="arm64" ;;
  x86_64) expected_node_arch="x64" ;;
  *) echo "Unsupported Mac packaging architecture" >&2; exit 3 ;;
esac
if [[ "$("$node_bin" -p 'process.platform')" != "darwin" ||
      "$("$node_bin" -p 'process.arch')" != "$expected_node_arch" ]]; then
  echo "Node OS/architecture differs from the Mac package target" >&2; exit 3
fi
node_license="$here/legal/node-v24.22.1/LICENSE"
test -s "$node_license" || { echo "Pinned Node third-party LICENSE missing" >&2; exit 3; }
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
cp "$node_license" "$app/Contents/Resources/NODE_LICENSE.txt"
# The Slint binary embeds third-party official UI media. Ship the matching
# pinned attribution and license notices in the portable developer package.
mkdir -p "$app/Contents/Resources/media-notices"
cp "$repo/tools/preview-build/media-source/CRAFT_SUITE_MEDIA_NOTICES.md" "$app/Contents/Resources/media-notices/"
cp "$repo/tools/preview-build/media-source/THIRD_PARTY_MEDIA_NOTICES.md" "$app/Contents/Resources/media-notices/"
cp "$repo/tools/preview-build/media-source/licenses/"*.txt "$app/Contents/Resources/media-notices/"
cp "$here/ui/APPROVED_GALLERY_INDEX.json" "$app/Contents/Resources/media-notices/"
cp "$here/ui/INDEPENDENT_NATIVE_MEDIA_NOTICES.md" "$app/Contents/Resources/media-notices/"
cp "$here/ui/MEDIA_CREDITS.json" "$app/Contents/Resources/media-notices/"
cp "$here/ui/MEDIA_CREDITS.md" "$app/Contents/Resources/media-notices/"

cp "$here/../slint-node-bridge/sidecar.mjs" "$app/Contents/Resources/"
cp "$here/../slint-node-bridge/live-catalog.mjs" "$app/Contents/Resources/"
cp "$here/../slint-node-bridge/install-bridge.mjs" "$app/Contents/Resources/"
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
if [[ "$("$app/Contents/Resources/node" --version)" != "$required_node_version" ||
      ! -s "$app/Contents/Resources/NODE_LICENSE.txt" ]]; then
  echo "Bundled Node version or required LICENSE is invalid" >&2; exit 3
fi
node_bundle_sha="$(shasum -a 256 "$app/Contents/Resources/node" | awk '{print $1}')"
echo "MAC_NATIVE_NODE_BUNDLE_PASS version=$required_node_version arch=$expected_node_arch sha256=$node_bundle_sha license=NODE_LICENSE.txt"
for bin in "$app/Contents/MacOS/challenger-slint-rust-host" "$app/Contents/Resources/node"; do
  if otool -L "$bin" | grep -E '/opt/homebrew/|/usr/local/lib/|libintl[.]8' ; then
    echo "Nonredistributable dynamic dependency in $bin" >&2; exit 2
  fi
done
/usr/bin/codesign --force --deep --sign - "$app"
echo "MAC_NATIVE_PACKAGE_PASS $app"
echo "Run for live backend QA: $app/Contents/MacOS/challenger-slint-rust-host --check-backend-only"
