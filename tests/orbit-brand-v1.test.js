'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),brand=path.join(root,'brand','orbit'),exp=path.join(brand,'export');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const count=x=>(html.match(new RegExp(x,'g'))||[]).length;
test('Orbit is added to Focus 4.0 without changing core route architecture',()=>{
 assert.match(html,/data-app-version="4\.0\.0"/);
 assert.equal(count('data-main="'),3);
 assert.equal(count('id="brandHome"'),1);
 assert.equal(count('id="homeScreen"'),1);
 assert.equal(count('id="projectScreen"'),1);
 assert.equal(count('id="libraryScreen"'),1);
 assert.equal(count('id="activityScreen"'),1);
 assert.equal(count('class="sidebar"'),0);
});
test('Orbit favicon and original icon replacement are real locally linked assets',()=>{
 assert.match(html,/rel="icon" type="image\/svg\+xml" href="\/brand\/orbit\/orbit-app-icon\.svg"/);
 assert.match(html,/rel="alternate icon" href="\/brand-icon\.png"/);
 assert.match(html,/src="\/brand\/orbit\/orbit-flat\.svg"/);
 assert.match(html,/src="\/brand\/orbit\/orbit-dark\.svg"/);
 assert.equal(count('src="/brand-icon.png"'),0);
 assert.ok(fs.existsSync(path.join(root,'favicon.ico')));
 const old=fs.readFileSync(path.join(root,'brand-icon.png'));
 assert.equal(old.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
});
test('Seven SVG variants have matching four-part Orbit geometry with no external references',()=>{
 const list=['orbit-signature.svg','orbit-flat.svg','orbit-dark.svg','orbit-mono-graphite.svg','orbit-mono-white.svg','orbit-app-icon.svg','orbit-app-icon-mono.svg'];
 for(const f of list){
  const s=fs.readFileSync(path.join(brand,f),'utf8');
  assert.match(s,/viewBox="0 0 256 256"/);
  for(const part of ['outer','inner','tail','dot'])assert.ok(s.includes('id="orbit-'+part+'"'),f+': '+part);
  assert.doesNotMatch(s,/<script|<foreignObject|<image |@font-face|data:image\/|href="https?:\/\//i);
 }
});
test('Light and dark mode render exactly one header symbol',()=>{
 assert.match(css,/:root\[data-theme="light"\] \.brand-mark-dark\{display:none\}/);
 assert.match(css,/:root\[data-theme="dark"\] \.brand-mark-light\{display:none\}/);
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/@media\(max-width:380px\)/);
});
test('Platform icon exports contain valid original PNG and icon container signatures',()=>{
 const sizes=[16,24,32,48,64,128,180,256,512,1024];
 for(const size of sizes){
  const b=fs.readFileSync(path.join(exp,'orbit-app-'+size+'.png'));
  assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(b.readUInt32BE(16),size);
  assert.equal(b.readUInt32BE(20),size);
 }
 for(const p of [path.join(root,'favicon.ico'),path.join(exp,'challenger-orbit.ico')]){
  const b=fs.readFileSync(p);assert.equal(b.readUInt16LE(0),0);assert.equal(b.readUInt16LE(2),1);
  assert.ok(b.readUInt16LE(4)>=6);
 }
 const icns=fs.readFileSync(path.join(exp,'challenger-orbit.icns'));
 assert.equal(icns.subarray(0,4).toString(),'icns');
 assert.ok(icns.length>10000);
});
test('No extra slogan, unauthorized call to install or third-party network dependency is added',()=>{
 assert.doesNotMatch(html,/DISCOVER A DIFFERENT ROUTE|A TOOL FOR WHAT.S NEXT/i);
 assert.doesNotMatch(css,/@import|https?:\/\//i);
 assert.doesNotMatch(html,/<link[^>]+fonts\.googleapis\.com/i);
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.equal((app.match(/fetch\(/g)||[]).length,1);
 assert.match(app,/method:'GET'/);
 assert.doesNotMatch(app,/method:'POST'|method:'PUT'|method:'DELETE'/);
});
test('Brand screenshot manifest records real Windows and Mac validation images',()=>{
 const j=JSON.parse(fs.readFileSync(path.join(root,'docs','previews','orbit-signature-v1','sha256.json'),'utf8'));
 assert.equal(j.screenshots.length,8);
 for(const x of j.screenshots){
  const b=fs.readFileSync(path.join(root,'docs','previews','orbit-signature-v1',x.file));
  assert.equal(b.length,x.bytes);
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'),x.sha256);
 }
});
