import test from 'node:test';
import assert from 'node:assert/strict';
import {assetFor,manualCheck,selectRelease,versionOf,SCHEMA} from './native-updates.mjs';
const digest='sha256:'+'a'.repeat(64);
function release(tag='native-v0.2.0',name='ChallengerHubNativePreview-macOS-arm64.zip',extra={}) {
  return {tag_name:tag, draft:false,
    assets:[{name,size:20000000,digest,
      browser_download_url:'https://github.com/nocturney/challenger-hub/releases/download/'+tag+'/'+name}],
    ...extra};
}
test('native version and architecture mapping are allowlisted',()=>{
  assert.deepEqual(versionOf('0.1.0'),[0,1,0]);
  assert.equal(versionOf('preview12'),null);
  assert.equal(assetFor('darwin','arm64'),'ChallengerHubNativePreview-macOS-arm64.zip');
  assert.equal(assetFor('linux','arm64'),null);
});
test('preview12/foreign assets are never offered as native updates',()=>{
  assert.equal(selectRelease([release('v4.0.0-orbit-preview.12')],{platform:'darwin',arch:'arm64',version:'0.1.0'}).status,'not-published');
  assert.equal(selectRelease([release('native-v0.2.0','ChallengerFocusDesktopPreview12.exe')],{platform:'darwin',arch:'arm64',version:'0.1.0'}).status,'not-published');
  assert.equal(selectRelease([release('native-v0.2.0',undefined,{draft:true})],{platform:'darwin',arch:'arm64',version:'0.1.0'}).status,'not-published');
});
test('verified matching asset and digest are mandatory, never install',async()=>{
  const valid=release();
  const opts={platform:'darwin',arch:'arm64',version:'0.1.0'};
  assert.equal(selectRelease([{...valid,assets:[{...valid.assets[0],digest:'wrong'}]}],opts).status,'not-published');
  const result=await manualCheck({...opts,fetcher:async()=>[valid]});
  assert.equal(result.schema,SCHEMA);
  assert.equal(result.status,'available');
  assert.equal(result.releaseVersion,'0.2.0');
  assert.equal(result.automaticInstallation,false);
  assert.equal(result.releaseUrl,'https://github.com/nocturney/challenger-hub/releases/tag/native-v0.2.0');
  assert.equal(selectRelease([valid],{...opts,version:'0.3.0'}).status,'current');
});
test('offline or invalid response gives explicit error, not a false current claim',async()=>{
  assert.equal((await manualCheck({fetcher:async()=>{throw Error('offline')}})).status,'error');
  assert.equal((await manualCheck({fetcher:async()=>({oops:true})})).status,'unavailable');
});
