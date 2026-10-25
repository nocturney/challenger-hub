'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {repoName,platformAssets,inspectReadme,verifyEvidence,options,choose,oneRepo,md}=require('./verify.cjs');
const base={
 full_name:'tiny/creative-studio',created_at:'2026-09-10T00:00:00Z',
 pushed_at:'2026-10-21T09:00:00Z',stargazers_count:15,language:'Rust',
 description:'AI-native creative studio with native editor, demos and screenshot reference',
 homepage:'https://example.com',license:{spdx_id:'MIT'},archived:false,disabled:false,
 fork:false,is_template:false
};
const release={
 name:'Creative Studio 0.2',tag_name:'v0.2.0',published_at:'2026-10-20T01:00:00Z',
 html_url:'https://github.com/tiny/creative-studio/releases/tag/v0.2.0',
 draft:false,prerelease:false,assets:[
  {name:'Studio-0.2-win-x64-setup.exe'},
  {name:'Studio-0.2-macos-arm64.dmg'},
  {name:'Studio-0.2-linux-amd64.AppImage'},
  {name:'Studio-0.2-win-x64-setup.exe.sig'},
  {name:'SHA256SUMS.txt'}
 ]};
test('reject invalid sources and unrecognized cli options',()=>{
 assert.throws(()=>repoName('../evil/repo'),/Invalid/);
 assert.throws(()=>repoName('evil//repo'),/Invalid/);
 assert.throws(()=>options(['--unknown']),/Unknown/);
 assert.throws(()=>options(['--limit','31','--repos','tiny/creative-studio']),/Limit/);
 assert.equal(options(['--repos','tiny/creative-studio','--limit','7']).limit,7);
});
test('separate OS artifacts by observed release file names, never count signatures',()=>{
 const p=platformAssets(release.assets.map(x=>x.name));
 assert.equal(p.windows.length,1);assert.equal(p.macos.length,1);assert.equal(p.linux.length,1);
 assert.equal(platformAssets(['source.zip','manifest.json','SHA256SUMS.txt']).windows.length,0);
});
test('inspect README claims but avoid inferring binary verification or paid API automatically',()=>{
 const s=inspectReadme('# Demo\n![Editor screenshot](docs/app.png)\nWindows and macOS builds.\nBYOK - OPENAI_API_KEY');
 assert.equal(s.imageReferenced,true);
 assert.equal(s.platformClaimsInDocs.windows,true);
 assert.equal(s.potentialExternalAIKeyRequirement,true);
});
test('official repo evidence never means install approval',()=>{
 const src=verifyEvidence('tiny/creative-studio',base,[release],'a '.repeat(130));
 assert.equal(src.sourceStatus,'source-accessible');
 assert.equal(src.assessment,'operator-review-required');
 assert.equal(src.installable,false);
 assert.equal(src.installerAdapter,null);
 assert.equal(src.release.assetCount,5);
 assert.equal(src.release.platformAssetNames.windows.length,1);
 assert.equal(src.readme.words>=100,true);
 assert.ok(src.checks.some(x=>x.name==='Official GitHub repository'&&x.status==='observed'));
});
test('an archived repo or prerelease-named stable is flagged',()=>{
 const src=verifyEvidence('tiny/creative-studio',{...base,archived:true},
  [{...release,name:'Studio pre-alpha release'}],'');
 assert.equal(src.sourceStatus,'archived');
 assert.equal(src.release.experimentalName,true);
 assert.ok(src.warnings.some(x=>/experimental/.test(x)));
 assert.ok(src.warnings.some(x=>/archived/.test(x)));
});
test('insufficient API evidence is explicit and no release is invented',()=>{
 const src=verifyEvidence('tiny/creative-studio',{...base,license:{spdx_id:'NOASSERTION'}},null,'');
 assert.equal(src.release,null);
 assert.equal(src.licenseSPDX,null);
 assert.ok(src.warnings.some(x=>/No non-prerelease/.test(x)));
});
test('official API client only reads repo, release list and README metadata',async()=>{
 const calls=[];
 const client=async route=>{
  calls.push(route);
  if(route==='repos/tiny/creative-studio')return base;
  if(route.includes('/releases?'))return [release];
  if(route.endsWith('/readme')){
   const content=Buffer.from('# Quick start\n'+'This app edits documents. '.repeat(75)).toString('base64');
   return {content,size:content.length,encoding:'base64'};
  }
  throw Error('unexpected API endpoint');
 };
 const result=await oneRepo('tiny/creative-studio',client);
 assert.equal(calls.length,3);
 assert.ok(calls.every(x=>x.startsWith('repos/tiny/creative-studio')));
 assert.equal(result.release.tag,'v0.2.0');
 assert.equal(result.readme.words>=100,true);
});
test('report creates operator review queue, not app catalog',()=>{
 const src=verifyEvidence('tiny/creative-studio',base,[release],'');
 const report={generatedAt:'2026-10-23',results:[src]};
 const output=md(report);
 assert.match(output,/human qualification/);
 assert.match(output,/No product was run/);
 assert.match(output,/Windows/i);
 assert.match(output,/operator/i);
});
