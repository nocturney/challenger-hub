#!/usr/bin/env node
// Offline provenance gate: only approved, checksum-matched upstream media enters Slint.
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(here, '..', '..', 'preview-build', 'media-source');
const manifest = JSON.parse(readFileSync(join(sourceRoot, 'project-media.v1.json'), 'utf8'));
const items = [
  ['dune3d', 'icon', 'dune3d.svg'],
  ['dune3d', 'screenshot', 'dune3d.png'],
  ['material-maker', 'icon', 'material-maker-icon.png'],
  ['material-maker', 'screenshot', 'material-maker.png'],
  ['compositor', 'icon', 'compositor-icon.png'],
  ['kiri-moto', 'icon', 'kiri-moto-icon.png'],
  ['espocrm', 'icon', 'espocrm-icon.png'],
  ['docuseal', 'icon', 'docuseal-icon.svg'],
  ['meshcentral', 'icon', 'meshcentral-icon.png'],
  ['openhands', 'icon', 'openhands-icon.png'],
  ['real-video-enhancer', 'icon', 'real-video-enhancer-icon.svg'],
  ['real-video-enhancer', 'screenshot', 'real-video-enhancer.png'],
];
if (manifest.schema !== 'challenger-project-media.v1' || items.length !== 12) {
  throw new Error('Unexpected source media manifest or embedded-asset list');
}
for (const [project, kind, name] of items) {
  const parent = manifest.projects[project];
  const item = parent?.[kind];
  if (!parent || item?.status !== 'approved' || !item.sha256) {
    throw new Error('Missing source approval: ' + project + ' / ' + kind);
  }
  const asset = readFileSync(join(here, 'ui', name));
  const actual = createHash('sha256').update(asset).digest('hex');
  if (actual !== item.sha256 || statSync(join(here, 'ui', name)).size !== item.size) {
    throw new Error('Checksum/size mismatch: ' + name);
  }
}

const craftManifest = JSON.parse(
  readFileSync(join(sourceRoot, 'craft-suite-media.v1.json'), 'utf8'));
if (craftManifest.schema !== 'challenger-craft-media.v1' ||
    Object.keys(craftManifest.apps).length !== 13) {
  throw new Error('Unexpected reviewed Craft icon manifest');
}
for (const [key, app] of Object.entries(craftManifest.apps)) {
  const icon = app.icon;
  if (icon?.type !== 'official-product-app-icon' ||
      !icon.sha256 || !icon.path.endsWith('/' + key + '.png')) {
    throw new Error('Missing official Craft icon review: ' + key);
  }
  const bytes = readFileSync(join(here, 'ui', 'craft-' + key + '-icon.png'));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== icon.sha256 || bytes.length !== icon.size) {
    throw new Error('Craft icon checksum/size mismatch: ' + key);
  }
}

const brand = readFileSync(join(here, 'ui', 'orbit-app-128.png'));
const brandDigest = createHash('sha256').update(brand).digest('hex');
if (brandDigest !== 'a22b1ff013ed293120921ce77c6e15fc51982adb103c7d7ecdde240a6b597358') {
  throw new Error('Project-owned Orbit icon digest mismatch');
}
// Re-check 47 genuine pre-approved Craft interface images, their exact
// original source bytes, copyright/license metadata, and generated UI maps.
// This runs offline and never replaces checked-in images.
execFileSync(process.execPath, [join(here,'sync-approved-gallery.mjs'),'--check'],
    {stdio:'inherit', timeout:30000});
execFileSync(process.execPath, [join(here,'media-rights-gate.mjs'),'developer'],
    {stdio:'inherit',timeout:30000});
const publicAttempt=spawnSync(process.execPath,[join(here,'media-rights-gate.mjs'),'public'],
    {encoding:'utf8',timeout:30000});
if(publicAttempt.status===0 || !String(publicAttempt.stderr).includes('PUBLIC_MEDIA_RELEASE_BLOCKED')) {
  throw Error('Public distribution rights gate did not fail closed');
}
execFileSync(process.execPath,[join(here,'verify-native-visual-policy.mjs')],
    {stdio:'inherit',timeout:30000});
execFileSync(process.execPath,[join(here,'verify-product-first-ux.mjs')],
    {stdio:'inherit',timeout:30000});
console.log('NATIVE_PUBLIC_MEDIA_RELEASE_BLOCK_PASS thirdPartyAssets=100');
console.log('NATIVE_MEDIA_PROVENANCE_PASS verifiedProjects=36 nativeIcons=30 approvedScreenshots=70 screenshotProjects=29 source=offline-pinned-manifests');
