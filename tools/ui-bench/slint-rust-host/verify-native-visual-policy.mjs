#!/usr/bin/env node
// Enforces the product decision: official upstream media OR a purely factual,
// typography-only identity card. Never invent app screenshots, brand marks,
// decorative mascots, category artwork, or simulated user interfaces.
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const ui=readFileSync(join(here,'ui/focus.slint'),'utf8');
const identity=readFileSync(join(here,'ui/identity-card.slint'),'utf8');
const product=readFileSync(join(here,'ui/catalog-card.slint'),'utf8');
const rust=readFileSync(join(here,'src/main.rs'),'utf8');
const inventory=JSON.parse(readFileSync(resolve(here,'../../../docs/visual-catalog/inventory-20261025.json'),'utf8'));
const gallery=JSON.parse(readFileSync(join(here,'ui/APPROVED_GALLERY_INDEX.json'),'utf8'));
function requirePolicy(ok,reason) {
  if(!ok)throw Error('NATIVE_VISUAL_POLICY_FAIL: '+reason);
}
const checkBindings=[
 'project-mode: project.visual-mode;',
 'project-summary: project.summary;',
 'project-media: project.media;',
 'if root.detail-visual-mode == "official": Rectangle {',
 'if root.detail-visual-mode == "identity": IdentityDossier {',
 'project-name: project.name;',
 'project-maker: project.maker;',
 'project-domain: project.domain;',
 'project-name: root.detail-name;',
 'project-maker: root.detail-maker;',
 'project-domain: root.detail-domain;',
 'project-summary: root.detail-summary;',
 'project-platforms: root.detail-platforms;',
 'project-source: root.detail-source;',
];
for(const expr of checkBindings) requirePolicy(ui.includes(expr),'Missing factual native rendering path '+expr);
for(const expr of [
 'if root.project-mode == "official": ApprovedGalleryThumb',
 'if root.project-mode == "identity": IdentityTile',
 'project-name: root.project-name;',
 'project-maker: root.project-maker;',
 'project-domain: root.project-domain;',
])requirePolicy(product.includes(expr),'Unapproved product card content: '+expr);
requirePolicy(!/@image-url|@linear-gradient|@radial-gradient/.test(product),
  'Product cards must use only the source-locked gallery or factual identity');

for(const expr of ['if gallery::count(media_id(p)) > 0 { "official" } else { "identity" }',
  'visual_mode: visual_mode(p).into()','ui.set_detail_visual_mode(visual_mode(p).into());']) {
  requirePolicy(rust.includes(expr),'Source-locked visual mode missing '+expr);
}
// Identity-card components may contain text, spacing, simple borders and colors.
// Native Slint Image / SVG / path / gradients would create fabricated visuals here.
requirePolicy(!/@image-url|Image\s*\{|Path\s*\{|@linear-gradient|@radial-gradient|@conic-gradient/.test(identity),
  'Identity cards must be typography-only with no built/generated art');
for(const banned of ['NO VERIFIED IMAGE','STUDIO PREVIEW','CRAFTED PREVIEW',
  'FAKE PREVIEW','SIMULATED INTERFACE','MONOGRAM']) {
  requirePolicy(!ui.toUpperCase().includes(banned),
    'Native front-end still uses an undesired image placeholder: '+banned);
}
requirePolicy(!/project\.initial\b/.test(ui),'Generated monogram icon is disallowed');
const rows=inventory.records;
requirePolicy(rows.length===181 && inventory.counts?.projects===181,'Expected real 181-row source snapshot');
const preview=rows.filter(x=>x.presentationMode==='official');
const profile=rows.filter(x=>x.presentationMode==='identity');
requirePolicy(preview.length===29 && profile.length===152,'Exactly 29 official and 152 factual identities required');
for(const r of rows) {
  requirePolicy(r.presentationMode===(r.screenshotCount>0?'official':'identity'),
   'A source entry has the wrong presentation mode: '+r.projectId);
  requirePolicy(r.name && r.repository && r.kind,
   'Identity card requires source-backed name/repository/kind: '+r.projectId);
  if(r.presentationMode==='identity') {
    requirePolicy(!r.screenshotSources?.length,
     'An identity card must not imply screenshot source: '+r.projectId);
  } else {
    requirePolicy(r.screenshotSources.length===r.screenshotCount,
     'Official preview without source identity: '+r.projectId);
  }
}
requirePolicy(gallery.totalShots===70 && gallery.totalIcons===30,
  'Official media index changed unexpectedly');
requirePolicy(preview.reduce((n,r)=>n+r.screenshotCount,0)===70,
  'No official screenshot may be omitted from source checks');
console.log('NATIVE_VISUAL_POLICY_PASS official=29 identity=152 inventedArtwork=0 inventedUI=0 syntheticIcons=0 total=181');
