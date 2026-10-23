'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),
 fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const base=path.join(root,'tools/preview-build/media-source');
const spec=JSON.parse(fs.readFileSync(path.join(base,'craft-suite-media.v1.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
test('all 13 official Craft product icons and 47 original screenshots are independently byte-audited',()=>{
 assert.equal(spec.schema,'challenger-craft-media.v1');
 assert.equal(Object.keys(spec.apps).length,13);
 let icons=0,photos=0;
 for(const [id,p] of Object.entries(spec.apps)){
  assert.match(id,/^[a-z]+craft$/);
  assert.ok(p.icon&&p.screenshots.length>=1);
  for(const [kind,item] of [['icon',p.icon],...p.screenshots.map(s=>['screenshot',s])]){
   const rel=item.path.slice(1),buf=fs.readFileSync(path.join(base,'assets',rel));
   assert.equal(sha(buf),item.sha256,rel);
   assert.equal(buf.length,item.size,rel);
   assert.match(item.source,/^https:\/\/github\.com\/storytold\//);
   assert.ok(['MIT OR Apache-2.0','Apache-2.0'].includes(item.license));
   if(kind==='icon'){icons++;assert.ok(buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))}
   else{photos++;assert.ok(item.path.endsWith('.jpg')?buf[0]===255&&buf[1]===216:
     buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))}
  }
 }
 assert.equal(icons,13);assert.equal(photos,47);
});
test('we distribute app icons but never the protected ArtCraft launcher company logo',()=>{
 const values=Object.values(spec.apps).flatMap(a=>[a.icon,...a.screenshots]).map(x=>x.path);
 assert.ok(values.every(x=>x.includes('/craft/')));
 assert.ok(!values.some(x=>/brand|mark|launcher-icon|wordmark/i.test(x)));
 assert.ok(fs.readFileSync(path.join(base,'CRAFT_SUITE_MEDIA_NOTICES.md'),'utf8').includes('ArtCraft'));
});
test('the managed Craft catalog has exactly the 13 matching published app icons; AniCraft has no official image or release yet',()=>{
 const j=JSON.parse(fs.readFileSync(path.join(root,'tools/desktop-build/seeds/managed-catalog.preview8.json'),'utf8'));
 assert.equal(j.apps.length,14);
 const published=j.apps.filter(a=>a.releaseTag);
 assert.equal(published.length,13);
 for(const a of published)assert.ok(spec.apps[a.repo],a.repo);
 const pending=j.apps.find(a=>a.repo==='AniCraft');
 assert.ok(pending);assert.equal(pending.releaseTag,null);
 assert.equal(spec.apps.AniCraft,undefined);
});
test('UI uses the official screenshots and distinguishes creator-owned updates from our broader catalog',()=>{
 const build=fs.readFileSync(path.join(root,'tools/desktop-build/build-runtime.cjs'),'utf8'),
  ui=fs.readFileSync(path.join(root,'tools/desktop-build/craft-suite-media-runtime.js'),'utf8'),
  quality=fs.readFileSync(path.join(root,'tools/desktop-build/project-quality-ui.js'),'utf8');
 for(const token of ['craft-media-index.js','CRAFT_SUITE_MEDIA_NOTICES.md','craft-suite-media-runtime.js','VERIFIED_CRAFT_APP_MEDIA_BUNDLED']){
  assert.ok(build.includes(token),token);
 }
 assert.ok(ui.includes('OFFICIAL APPLICATION SCREENSHOT'));
 assert.ok(ui.includes('View all '));
 assert.ok(quality.includes('https://github.com/storytold/craft-launcher/releases/latest'));
 assert.ok(quality.includes('!!(a.releaseTag||a.latestVersion||a.installedVersion||a.installable)'));
});
