#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const ui=readFileSync(join(here,'ui/focus.slint'),'utf8');
const card=readFileSync(join(here,'ui/catalog-card.slint'),'utf8');
const native=readFileSync(join(here,'src/main.rs'),'utf8');
const inventory=JSON.parse(readFileSync(resolve(here,'../../../docs/visual-catalog/inventory-20261025.json'),'utf8'));
function check(ok,reason) {if(!ok)throw Error('PRODUCT_FIRST_UX_FAIL: '+reason);}
for(const phrase of [
 'Discover software','Browse full software catalog','flex-wrap: wrap',
 'project.visual-mode','CatalogProductCard {','for project[i] in root.entries',
 'project-summary: project.summary','root.open-project(i)',
 'root.open-discipline(group.id)','root.open-discipline("all")',
 'if root.detail-visual-mode == "identity": IdentityDossier',
 'if root.detail-visual-mode == "official": Rectangle',
 'root.detail-technical-open = !root.detail-technical-open',
 'root.review-install()','root.confirm-install()',
 'root.install-approved','app.status','app.latest','app.installed',
 'root.navigate("device")','Not detected does not mean uninstalled',
 'SOFTWARE CARDS', 'root.open-project(i)',
])check(ui.includes(phrase),'Missing product/safety capability: '+phrase);
check(ui.indexOf('if root.detail-visual-mode == "identity": IdentityDossier')<
      ui.indexOf('if root.detail-reviewable: Rectangle'),'Hero must precede installer diagnostics');
check(ui.indexOf('if root.detail-visual-mode == "official": Rectangle')<
      ui.indexOf('if root.detail-reviewable: Rectangle'),'Official imagery must precede installer diagnostics');
check(!/NO VERIFIED IMAGE|PROJECT DOSSIER|SOURCE \/ REVIEW STATUS|PROJECT FACTS/.test(ui),
 'Report-like primary headings remain');
check(!/Image\s*\{|@image-url/.test(card) && card.includes('ApprovedGalleryThumb') &&
  card.includes('IdentityTile'),'Catalog cards may only render approved media or factual identity');
check(ui.includes('accessible-action-default => { root.open-project(i); }'),
 'Full-card keyboard accessibility missing');
check(native.includes('ui.set_entries('),
 'Native catalog must preserve source-backed result indexes');
check(native.includes('ui.set_detail_technical_open(false);'),
 'Technical disclosure must reset between project dossiers');
check(inventory.counts.projects===181 &&
 inventory.counts.officialPreviewProjects===29 &&
 inventory.counts.identityCardProjects===152,'Unverified catalog identity coverage');
check(inventory.counts.screenshotFrames===70 &&
 inventory.counts.nativeIcons===30,'Original media provenance changed unexpectedly');
console.log('PRODUCT_FIRST_UX_GATE_PASS catalog=181 modes=2 layout=stable-product-cards backend=unchanged source=truthful');
