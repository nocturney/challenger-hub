#!/usr/bin/env node
// Offline provenance gate: only approved, checksum-matched upstream media enters Slint.
import { createHash } from 'node:crypto';
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
const brand = readFileSync(join(here, 'ui', 'orbit-app-128.png'));
const brandDigest = createHash('sha256').update(brand).digest('hex');
if (brandDigest !== 'a22b1ff013ed293120921ce77c6e15fc51982adb103c7d7ecdde240a6b597358') {
  throw new Error('Project-owned Orbit icon digest mismatch');
}
console.log('NATIVE_MEDIA_PROVENANCE_PASS verifiedProjects=9 approvedIcons=9 approvedScreenshots=3 source=offline-manifest');
