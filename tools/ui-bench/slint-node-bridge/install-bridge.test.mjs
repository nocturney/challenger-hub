import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedSource,reviewOfficialRelease,appendInstallHistory,readInstallHistory} from './install-bridge.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const registry={projects:[
  {id:'compositor',name:'Compositor',repository:'robbietilton/Compositor'},
  {id:'research-risk',name:'Compositor Fake',repository:'someorg/fake'}
]};
const adapters={schema:'challenger-adapters.v1',projects:{
  compositor:{darwin:{kind:'dmg',asset:'^Compositor\\.dmg$',appHint:'Compositor'}}
}};
const source=()=>reviewedSource('curated:compositor',{registry,adapters,platform:'darwin',arch:'arm64'});
const release=()=>({
  tag_name:'v1.5.8',draft:false,prerelease:false,
  html_url:'https://github.com/robbietilton/Compositor/releases/tag/v1.5.8',
  assets:[{name:'Compositor.dmg',size:8539058,digest:'sha256:'+'a'.repeat(64),
    browser_download_url:'https://github.com/robbietilton/Compositor/releases/download/v1.5.8/Compositor.dmg'}]
});
test('exact source, reviewed adapter and hash yield a frozen approval fingerprint',()=>{
  const s=source();
  const a=reviewOfficialRelease(s,release()),b=reviewOfficialRelease(s,release());
  assert.equal(a.projectId,'curated:compositor');
  assert.equal(a.assetName,'Compositor.dmg');
  assert.equal(a.sha256,'a'.repeat(64));
  assert.equal(a.approvalToken,b.approvalToken);
  assert.equal(a.requiresUserApproval,true);
  assert.equal(a.sourceDigestVerifiedAfterDownload,false);
  const changed=release();
  changed.assets[0].digest='sha256:'+'b'.repeat(64);
  assert.notEqual(a.approvalToken,reviewOfficialRelease(s,changed).approvalToken);
});
test('wrong catalog kinds, duplicates, unknown repo, and platform are denied',()=>{
  for(const id of ['managed:compositor','research:compositor','curated:unknown',
    'curated:../compositor'])assert.throws(()=>reviewedSource(id,{
    registry,adapters,platform:'darwin',arch:'arm64'}));
  assert.throws(()=>reviewedSource('curated:compositor',{
    registry:{projects:[...registry.projects,registry.projects[0]]},
    adapters,platform:'darwin',arch:'arm64'}));
  assert.throws(()=>reviewedSource('curated:compositor',{registry,adapters,platform:'linux'}));
  assert.throws(()=>reviewedSource('curated:compositor',{registry,adapters,platform:'darwin',arch:'x64'}));
});
test('no installer without official digest, exact URL or unique asset',()=>{
  const mutate=[
    x=>{x.assets[0].digest=null},
    x=>{x.assets[0].browser_download_url='https://github.com.evil.tld/fake'},
    x=>{x.assets[0].browser_download_url=x.assets[0].browser_download_url.replace('Compositor.dmg','Other.dmg')},
    x=>{x.assets.push({...x.assets[0]})},
    x=>{x.draft=true}, x=>{x.prerelease=true},
    x=>{x.tag_name='v1.5.8;rm -rf /'},
    x=>{x.assets[0].name='../Compositor.dmg'},
    x=>{x.html_url='https://github.com/malicious/repo/releases/tag/v1.5.8'}
  ];
  for(const change of mutate){const x=release();change(x);
    assert.throws(()=>reviewOfficialRelease(source(),x));}
});
test('installation CLI has no implicit default action',()=>{
  assert.equal(reviewOfficialRelease(source(),release()).schema,
    'challenger.native.install-plan.v1');
  // Neither importing the planner nor building a plan launches an installer,
  // downloads a package, creates a worker state, or asks for elevation.
});


// PdfCraft is a managed listing, not a curated project. It has exactly one
// source-pinned native install path: the Windows x64 GitHub portable ZIP.
const pdfManaged={apps:[{
  repo:'pdfcraft',title:'PdfCraft',repoUrl:'https://github.com/storytold/pdfcraft'
}]};
const pdfPortable={schema:'challenger-portable.v1',projects:{pdfcraft:{win32:{
  kind:'zip',asset:String.raw`^pdfcraft-[^/]+-windows-x64-portable\.zip$`,exeHint:'pdfcraft'
}}}};
const pdfSource=()=>reviewedSource('managed:pdfcraft',{
  registry,adapters,managed:pdfManaged,portable:pdfPortable,
  platform:'win32',arch:'x64'
});
const pdfRelease=()=>({
  tag_name:'v0.13.0',draft:false,prerelease:false,
  html_url:'https://github.com/storytold/pdfcraft/releases/tag/v0.13.0',
  assets:[{
    name:'pdfcraft-0.13.0-windows-x64-portable.zip',
    size:88133416,
    digest:'sha256:60c3fcb28548f3ab09e332c0cc5388f17e38d2c3ccbbe9f1a2c7080844387629',
    browser_download_url:'https://github.com/storytold/pdfcraft/releases/download/v0.13.0/pdfcraft-0.13.0-windows-x64-portable.zip'
  }]
});
test('managed PdfCraft allows only a pinned Windows x64 portable review',()=>{
  const source=pdfSource(),plan=reviewOfficialRelease(source,pdfRelease());
  assert.equal(source.projectId,'managed:pdfcraft');
  assert.equal(source.repository,'storytold/pdfcraft');
  assert.equal(plan.kind,'zip');
  assert.equal(plan.assetName,'pdfcraft-0.13.0-windows-x64-portable.zip');
  assert.equal(plan.sha256,'60c3fcb28548f3ab09e332c0cc5388f17e38d2c3ccbbe9f1a2c7080844387629');
  assert.equal(plan.requiresUserApproval,true);
  assert.equal(plan.sourceDigestVerifiedAfterDownload,false);
  const changed=pdfRelease();
  changed.assets[0].digest='sha256:'+'0'.repeat(64);
  assert.notEqual(reviewOfficialRelease(source,changed).approvalToken,plan.approvalToken);
});
test('managed PDF adapter fails closed on impersonation, other apps and platforms',()=>{
  const base={registry,adapters,managed:pdfManaged,portable:pdfPortable,platform:'win32',arch:'x64'};
  for(const id of ['managed:wordcraft','managed:PdfCraft','research:pdfcraft','curated:pdfcraft'])
    assert.throws(()=>reviewedSource(id,base));
  for(const args of [
    {...base,platform:'darwin'},
    {...base,platform:'linux'},
    {...base,arch:'arm64'},
    {...base,managed:{apps:[...pdfManaged.apps,...pdfManaged.apps]}},
    {...base,managed:{apps:[{...pdfManaged.apps[0],repoUrl:'https://github.com/evil/pdfcraft'}]}},
    {...base,portable:{...pdfPortable,projects:{pdfcraft:{win32:{...pdfPortable.projects.pdfcraft.win32,kind:'msi'}}}}},
    {...base,portable:{...pdfPortable,projects:{pdfcraft:{win32:{...pdfPortable.projects.pdfcraft.win32,asset:'^.*\\.exe$'}}}}}
  ])assert.throws(()=>reviewedSource('managed:pdfcraft',args));
  const bad=pdfRelease();bad.assets[0].digest=null;
  assert.throws(()=>reviewOfficialRelease(pdfSource(),bad));
});


test('approved installation history is durable, bounded and token-free',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'challenger-history-'));
  try{
    const event={runId:'11111111-1111-4111-8111-111111111111',
      projectId:'curated:solvespace',tag:'v3.3',sha256:'a'.repeat(64),
      state:'STARTED',timestamp:'2026-10-24T10:00:00.000Z',
      approvalToken:'DO_NOT_STORE',installedPath:'DO_NOT_STORE'};
    assert.deepEqual(readInstallHistory(folder).entries,[]);
    assert(!fs.existsSync(path.join(folder,'install-history.jsonl')));
    appendInstallHistory(folder,event);
    assert.equal(readInstallHistory(folder).entries[0].state,'UNRESOLVED');
    appendInstallHistory(folder,{...event,state:'COMPLETED',
      timestamp:'2026-10-24T10:02:00.000Z'});
    const result=readInstallHistory(folder);
    assert.equal(result.schema,'challenger.native.install-history.v1');
    assert.equal(result.incomplete,false);
    assert.equal(result.entries[0].state,'COMPLETED');
    assert.equal(result.entries[0].sha256,'a'.repeat(64));
    const saved=fs.readFileSync(path.join(folder,'install-history.jsonl'),'utf8');
    assert(!saved.includes('DO_NOT_STORE'));
    assert.equal(saved.trim().split('\n').length,2);
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('interrupted or corrupt history never fabricates successful installs',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'challenger-history-'));
  try{
    const event={runId:'22222222-2222-4222-8222-222222222222',
      projectId:'managed:pdfcraft',tag:'v0.13.0',sha256:'b'.repeat(64),
      state:'STARTED',timestamp:'2026-10-24T10:03:00.000Z'};
    appendInstallHistory(folder,event);
    assert.equal(readInstallHistory(folder).entries[0].state,'UNRESOLVED');
    fs.appendFileSync(path.join(folder,'install-history.jsonl'),'{"partial":true');
    const damaged=readInstallHistory(folder);
    assert.equal(damaged.incomplete,true);
    assert.equal(damaged.entries[0].state,'UNRESOLVED');
    assert.throws(()=>appendInstallHistory(folder,{...event,state:'COMPLETED'}));
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});

test('tampered history and unsupported statuses are rejected',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'challenger-history-'));
  try{
    const event={runId:'33333333-3333-4333-8333-333333333333',
      projectId:'managed:pdfcraft',tag:'v0.13.0',sha256:'c'.repeat(64),
      state:'STARTED',timestamp:'2026-10-24T10:05:00.000Z'};
    assert.throws(()=>appendInstallHistory(folder,{...event,state:'SUCCESS'}));
    assert.throws(()=>appendInstallHistory(folder,{...event,projectId:'research:unknown'}));
    appendInstallHistory(folder,event);
    assert.throws(()=>appendInstallHistory(folder,{...event,runId:'invalid'}));
    fs.appendFileSync(path.join(folder,'install-history.jsonl'),
      '{"schema":"invalid","state":"COMPLETED"}\n');
    assert.throws(()=>readInstallHistory(folder));
  }finally{fs.rmSync(folder,{recursive:true,force:true});}
});
