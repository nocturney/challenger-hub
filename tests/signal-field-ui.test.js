'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const section=(from,to)=>{const a=js.indexOf(from),b=js.indexOf(to,a+from.length);assert.ok(a>=0&&b>a);return js.slice(a,b)};
test('Signal Field 3.1 uses a new art-directed, singular Discover map',()=>{
 assert.match(html,/data-app-version="3\.1\.0"/);
 assert.equal((html.match(/id="discoveryStage"/g)||[]).length,1);
 assert.equal((html.match(/id="domainFilters"/g)||[]).length,1);
 assert.equal((html.match(/id="signalLiveCount"/g)||[]).length,1);
 const start=html.indexOf('id="discoveryStage"'),map=html.indexOf('id="domainSection"'),today=html.indexOf('id="dailyPick"'),end=html.indexOf('id="challengeWorkflows"');
 assert.ok(start>0&&map>start&&today>map&&end>today);
 assert.match(css,/CHALLENGER HUB \/ SIGNAL FIELD/);
});
test('All seventeen disciplines remain available using the original real category filter actions',()=>{
 const fn=section('function renderDomains(){','function updateWorkspaceControls(){');
 assert.match(fn,/DOMAIN_GROUPS\.filter/);
 assert.match(fn,/state\.apps\.length/);
 assert.match(fn,/data-domain=/);
 assert.match(fn,/style="--sector-color:/);
 assert.match(fn,/sort\(\(a,b\)=>/);
 assert.match(js,/\$\('domainFilters'\)\.addEventListener\('click'/);
 assert.match(js,/ui\.domain=b\.dataset\.domain/);
 assert.match(html,/id="domainExpandButton"/);
 assert.match(css,/#domainSection\.domains-expanded \.domain-filters/);
 assert.equal((js.match(/\['all','Everything'/g)||[]).length,1);
});
test('Overview counts are derived from actual installed/searchable project state',()=>{
 assert.match(js,/const counts=new Map\(DOMAIN_GROUPS\.map/);
 assert.match(js,/for\(const a of state\.apps\)/);
 assert.match(js,/set\('signalLiveCount',c\.all\)/);
 assert.match(js,/state\.apps\.length/);
 assert.match(js,/a\.installedVersion/);
 assert.match(js,/a\.needsUpdate/);
});
test('Project-card numbers represent result position, not fake rank or project quality',()=>{
 assert.match(js,/function cardMarkup\(a,index=0\)/);
 assert.match(js,/String\(index\+1\)\.padStart\(3,'0'\)/);
 assert.match(js,/list\.map\(cardMarkup\)/);
 assert.match(css,/\.field-card-index/);
});
test('Familiar-brand shortcut duplicates are hidden, global search continues to work',()=>{
 assert.match(css,/html\[data-hub-page="discover"\] #challengeWorkflows\{display:none!important\}/);
 assert.match(js,/window\.ChallengerUX/);
 assert.match(html,/id="searchInput"/);
 assert.match(html,/id="globalSearchContext"/);
 assert.match(html,/data-filter="new"/);
 assert.doesNotMatch(html,/data-filter="updates"/);
});
test('Theme, mobile, reduced motion, and singular operation navigation are preserved',()=>{
 assert.match(css,/:root\[data-theme=dark\]/);
 assert.match(css,/:root\[data-theme=light\]/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.equal((html.match(/id="queueNavButton"/g)||[]).length,1);
 for(const obsolete of ['queueViewButton','queueToolbarButton','queueDockOpen','workQueue']){
  assert.equal((html.match(new RegExp('id="'+obsolete+'"','g'))||[]).length,0);
 }
});
test('No automatic installation authorization is added to unverified research',()=>{
 const reg=JSON.parse(fs.readFileSync(path.join(root,'challengers.json'),'utf8'));
 assert.equal(reg.projects.length,152);
 const research=reg.projects.filter(p=>p.reviewStatus==='research-candidate-unverified');
 assert.equal(research.length,73);
 for(const p of research){assert.equal(p.installable,false);assert.equal(p.installAdapter,null)}
 assert.match(js,/function safeGitHubUrl\(/);
});
