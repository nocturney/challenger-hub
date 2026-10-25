#!/usr/bin/env node
// Media provenance != rights clearance. The regular developer-preview pipeline
// audits original assets and credits, while public release must fail closed until
// media-specific reproduction and trademark claims are independently reviewed.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ledger = JSON.parse(readFileSync(join(here,'ui','MEDIA_CREDITS.json'),'utf8'));
const gallery = JSON.parse(readFileSync(join(here,'ui','APPROVED_GALLERY_INDEX.json'),'utf8'));
const mode = process.argv[2] ?? 'developer';
if (!['developer','public'].includes(mode) || process.argv.length>3)
  throw Error('Usage: node media-rights-gate.mjs [developer|public]');
if (ledger.schema !== 'challenger-native-media-attribution.v1' ||
    ledger.copyrightClearance !== 'not-independently-verified' ||
    ledger.thirdPartyMediaPublicReleaseApproved !== false ||
    ledger.totals?.sourceVerifiedAssets !== 100 ||
    ledger.totals?.screenshots !== 70 ||
    ledger.totals?.icons !== 30 ||
    !Array.isArray(ledger.entries) || ledger.entries.length !== 100)
  throw Error('Rights ledger is missing, incomplete or overclaims public clearance');
if (gallery.totalShots!==70 || gallery.totalIcons!==30 ||
    gallery.assets.length!==70 || gallery.icons.length!==8)
  throw Error('Native image metadata and rights ledger disagree');
const expected=new Map();
for(const source of gallery.assets) {
  const key=source.media+':screenshot:'+source.index;
  if(expected.has(key))throw Error('Duplicate screenshot identity '+key);
  expected.set(key,{sha256:source.sha256,sourceUrl:source.sourceUrl});
}
for(const source of ledger.entries) {
  const key=source.media+':'+source.assetKind+':'+(source.assetKind==='screenshot'?source.index:'icon');
  if(source.assetKind==='icon') {
    // Eight new icons are recorded in the gallery index; previous 22 icons
    // are verified independently from the pinned Craft/curated manifests.
    const newIcon=gallery.icons.find(i=>i.media===source.media);
    if(newIcon) {
      if(newIcon.sha256!==source.sha256||newIcon.sourceUrl!==source.sourceUrl)
        throw Error('New embedded icon attribution mismatch '+key);
    }
  } else {
    const known=expected.get(source.media+':screenshot:'+source.index);
    if(!known || known.sha256!==source.sha256 ||
        known.sourceUrl!==source.sourceUrl)throw Error('Screenshot credit mismatch '+key);
  }
  if(!/^[a-f0-9]{64}$/.test(source.sha256) ||
     source.mediaSpecificPermission!=='unverified' ||
     !source.sourceRepository || !source.repositoryReportedLicense ||
     source.sourceRepository.length>110 ||
     !['unverified','not-evaluated'].includes(source.trademarkPermission))
    throw Error('Missing/overstated image permission record '+key);
  const parsed=new URL(source.sourceUrl);
  if(parsed.protocol!=='https:' ||
     !['github.com','raw.githubusercontent.com'].includes(parsed.hostname) ||
     parsed.username||parsed.password||parsed.port ||
     parsed.pathname.indexOf('/'+source.sourceRepository+'/')!==0)
    throw Error('Unsafe media credit link '+key);
}
const iconCount=ledger.entries.filter(x=>x.assetKind==='icon').length;
const screenshotCount=ledger.entries.filter(x=>x.assetKind==='screenshot').length;
const unique=new Set(ledger.entries.map(x=>x.assetKind+':'+x.media+':'+
  (x.assetKind==='screenshot'?x.index:'icon')));
if(unique.size!==100||iconCount!==30||screenshotCount!==70)
  throw Error('Duplicate or missing source attribution');
if(mode==='public') {
  throw Error('PUBLIC_MEDIA_RELEASE_BLOCKED: 100 source credits exist, but individual image/trademark distribution rights are not yet independently confirmed. Attribution alone is insufficient.');
}
console.log('NATIVE_MEDIA_CREDITS_PASS screenshots=70 icons=30 verifiedSources=100 publicRedistributionClearance=pending');
