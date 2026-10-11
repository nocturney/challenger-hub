'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const count=id=>(html.match(new RegExp('id="'+id+'"','g'))||[]).length;
test('Nexus 3.2 is a spatial research instrument, not the Observatory hero or Signal Field poster',()=>{
 assert.match(html,/data-app-version="3\.2\.0"/);
 assert.match(css,/NEXUS 3\.2 — A SPATIAL RESEARCH INSTRUMENT/);
 for(const id of ['discoveryStage','nexusGraphPlane','nexusWires','nexusTotal','nexusRecentRows','nexusSelectedCaption']){
  assert.equal(count(id),1,id);
 }
 assert.match(css,/\.nexus-legacy\{display:none!important\}/);
 assert.match(css,/:root\[data-hub-page=discover\] #challengeWorkflows\{display:none!important\}/);
});
test('The category map is one functional control for actual state-derived domains',()=>{
 const begin=js.indexOf('function renderDomains(){'),end=js.indexOf('/* Challenger v3',begin);
 const f=js.slice(begin,end);
 assert.ok(end>begin,'render function');
 for(const check of ['counts.set(domain','counts.set(\'all\',state.apps.length)','data-domain=','aria-pressed=','renderNexusWires(nodes)']){
  assert.ok(f.includes(check),'real category data: '+check);
 }
 assert.match(js,/ui\.domain=b\.dataset\.domain/);
 assert.match(js,/function renderNexusWires\(nodes\)/);
 assert.match(css,/\.nexus-wire\{/);
 const values=js.slice(js.indexOf('const DOMAIN_GROUPS=['),js.indexOf('];',js.indexOf('const DOMAIN_GROUPS=[')));
 assert.equal((values.match(/^\s*\['/gm)||[]).length,18,'Everything + seventeen domains');
});
test('Mobile users have access to all sectors, not just the six primary nodes',()=>{
 assert.equal(count('domainExpandButton'),1);
 const i=html.indexOf('id="nexusGraphPlane"'),button=html.indexOf('id="domainExpandButton"');
 assert.ok(i>0&&button>i,'mobile expand control must sit outside hidden desktop map heading');
 assert.match(css,/\.nexus-domain-section\.domains-expanded \.domain-pill:nth-child\(n\+8\)\{display:flex!important\}/);
 assert.match(js,/setDomainsExpanded\(!ui.domainsExpanded\)/);
});
test('Center hub resets category via the original category filter, no duplicate destinations',()=>{
 assert.match(css,/\.domain-pill\.nexus-core/);
 assert.ok(js.includes("i===0?' nexus-core':''")); // index-zero Everything maps to the center
 assert.equal(count('queueNavButton'),1);
 for(const bad of ['queueDockOpen','queueToolbarButton','queueViewButton','workQueue']){
  assert.equal(count(bad),0,bad);
 }
 assert.match(css,/:root\[data-hub-page=discover\] \.main-heading\{display:none!important\}/);
});
test('Right desk contains real daily and release data without granting install permission',()=>{
 assert.equal(count('dailyPick'),1);
 assert.equal(count('nexusRecentRows'),1);
 assert.match(js,/function renderNexusFeed\(\)/);
 assert.match(js,/a\.publishedAt&&Date\.parse\(a\.publishedAt\)>0&&a\.repoUrl/);
 assert.match(js,/data-nexus-repo/);
 assert.match(js,/openDiscoveryProject\(btn\.dataset\.nexusRepo\)/);
 assert.match(js,/function safeGitHubUrl\(/);
 assert.match(html,/Repository-linked, reported dates/);
});
test('Legible source-based data; research-only inventory still non-installable',()=>{
 const inventory=JSON.parse(fs.readFileSync(path.join(root,'challengers.json'),'utf8'));
 assert.equal(inventory.projects.length,152);
 const restricted=inventory.projects.filter(p=>p.reviewStatus==='research-candidate-unverified');
 assert.equal(restricted.length,73);
 for(const p of restricted){assert.equal(p.installable,false);assert.equal(p.installAdapter,null)}
 assert.match(js,/getCounters\(\)/);
});
test('Style respects light theme, mobile, and reduced motion',()=>{
 assert.match(css,/:root\[data-theme=light\]/);
 assert.match(css,/:root\[data-theme=dark\]/);
 assert.match(css,/@media\(max-width:1170px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
});
