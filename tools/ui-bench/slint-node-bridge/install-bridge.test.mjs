import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedSource,reviewOfficialRelease} from './install-bridge.mjs';

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
