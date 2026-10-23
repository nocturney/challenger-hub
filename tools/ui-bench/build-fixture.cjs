'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const projectRoot=path.resolve(__dirname,'../..'),dataRoot=path.join(__dirname,'data');
function load(p){return JSON.parse(fs.readFileSync(path.join(projectRoot,p),'utf8'))}
const managed=load('tools/desktop-build/seeds/managed-catalog.preview10.json').apps;
const curated=load('challengers.json').projects;
const candidates=load('tools/desktop-build/seeds/catalog-candidates.preview10.json').candidates;
const cleaned=s=>String(s||'').replace(/\s+/g,' ').trim();
const limit=s=>cleaned(s).slice(0,280);
function row(a,kind){
 const name=cleaned(a.name||a.title||a.repo||a.id);
 const id=cleaned(a.id||a.repo||name).replace(/\s/g,'-');
 const platforms=Array.isArray(a.reportedPlatforms)?a.reportedPlatforms:
  Array.isArray(a.platforms)?a.platforms:[];
 return {
  id:kind+':'+id,name,
  maker:cleaned(a.creator||a.author||a.repository?.split('/')[0]||a.repoUrl?.split('/')[3]||'Independent developer'),
  category:cleaned(a.group||a.category||'Creative tools'),
  summary:limit(a.summary||a.description||a.whyReview||'Source-linked independent project'),
  platforms:cleaned(platforms.join(', ')||'Not yet verified'),
  evidence:kind==='research'?'Research only':kind==='managed'?'Managed catalog':'Curated source',
  source:cleaned(a.repository||a.repoUrl||a.sourceUrl||''),
  kind
 };
}
const rows=[
 ...managed.map(a=>row(a,'managed')),
 ...curated.map(a=>row(a,'curated')),
 ...candidates.map(a=>row(a,'research'))
];
assert.equal(managed.length,14);assert.equal(curated.length,152);assert.equal(candidates.length,15);
assert.equal(rows.length,181);
assert.equal(new Set(rows.map(x=>x.id)).size,181,'Duplicate IDs in benchmark fixture');
fs.mkdirSync(dataRoot,{recursive:true});
const payload={schema:'challenger-ui-benchmark.v1',basedOn:'Preview 11 source snapshot',
 entryCount:rows.length,counts:{managed:14,curated:152,research:15},entries:rows};
const json=JSON.stringify(payload);
fs.writeFileSync(path.join(dataRoot,'challenger181.json'),JSON.stringify(payload,null,2)+'\n');
const sha=crypto.createHash('sha256').update(json).digest('hex');
console.log('BENCH_FIXTURE_PASS '+JSON.stringify({rows:rows.length,sha256:sha,bytes:Buffer.byteLength(json),kinds:payload.counts}));
