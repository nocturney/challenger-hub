'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const count=x=>(html.match(new RegExp(x,'g'))||[]).length;
test('Focus v4 is an independent information architecture, not a restyled dashboard',()=>{
 assert.match(html,/data-app-version="4\.0\.0"/);
 assert.equal(count('class="sidebar"'),0);
 assert.equal(count('class="hero '),0);
 assert.equal(count('id="discoveryStage"'),0);
 assert.equal(count('class="app-card"'),0);
 assert.doesNotMatch(html,/ux-experience\.js|shader-loader\.js/);
 for(const s of ['homeScreen','exploreScreen','projectScreen','libraryScreen','activityScreen'])assert.equal(count('id="'+s+'"'),1);
 assert.match(css,/NEW IA: action first -> list -> full document/);
});
test('Only three primary navigation destinations; installed and updates are nested',()=>{
 assert.equal((html.match(/data-main="/g)||[]).length,3);
 for(const route of ['home','library','activity'])assert.match(html,new RegExp('data-main="'+route+'"'));
 assert.equal((html.match(/data-library="/g)||[]).length,2);
 assert.match(html,/data-library="installed"/);
 assert.match(html,/data-library="updates"/);
 assert.equal(count('id="queueNavButton"'),0);
});
test('Discovery is input-driven; no catalog is automatically rendered on the home screen',()=>{
 assert.match(html,/id="homeSearchForm"/);
 assert.match(html,/id="disciplineList"/);
 assert.match(html,/id="recentList"/);
 assert.match(html,/id="exploreRows"/);
 assert.match(js,/function goBrowse\(opts=\{\}\)/);
 assert.match(js,/setScreen\('explore'\)/);
 assert.match(js,/function goProject\(repo,returnTo\)/);
 assert.match(js,/function renderDocument\(a\)/);
});
test('Backend data are authoritative and must not fall back to fixtures',()=>{
 assert.match(js,/fetch\('\/api\/state',\{method:'GET',cache:'no-store'\}\)/);
 assert.match(js,/Array\.isArray\(data\.apps\)/);
 assert.match(js,/Array\.isArray\(data\.discoveries\)/);
 assert.match(js,/projects=\[\.\.\.data\.apps\.map/);
 assert.match(js,/Source check warning/);
 assert.match(js,/No placeholder products or simulated state will be shown/);
});
test('Search covers actual familiar software and source metadata',()=>{
 assert.match(js,/function challengesOf\(a\)/);
 assert.match(js,/function searchBlob\(a\)/);
 assert.match(js,/competit|a\.original/);
 assert.match(js,/function relevance\(a,q\)/);
 assert.match(js,/function renderSuggestions\(\)/);
 assert.match(js,/function renderBrowse\(\)/);
});
test('Dossier uses source-controlled metadata only and safe outbound repository URLs',()=>{
 assert.match(js,/function sourceLink\(v\)/);
 assert.match(js,/u\.protocol==='https:'/);
 for(const host of ['github.com','gitlab.com','codeberg.org','invent.kde.org'])assert.ok(js.includes(host));
 assert.match(js,/rel="noopener noreferrer"/);
 assert.match(js,/function renderDocument\(a\)/);
 assert.match(js,/NO INSTALL, LAUNCH OR UPDATE ACTIONS/);
});
test('Read-only concept never transmits installation, launch, update, scan or settings writes',()=>{
 assert.equal((js.match(/fetch\(/g)||[]).length,1);
 assert.equal((js.match(/method:'GET'/g)||[]).length,1);
 assert.doesNotMatch(js,/method:'POST'|method:'PUT'|method:'DELETE'|api\/install|api\/update|api\/launch/);
 assert.doesNotMatch(html,/id="confirmAccept"|id="updateAllButton"|data-action="install"/);
});
test('Navigation supports browser Back/Forward and contextual project returns',()=>{
 assert.match(js,/history\.pushState/);
 assert.match(js,/history\.replaceState/);
 assert.match(js,/addEventListener\('popstate'/);
 assert.match(js,/function goBack\(\)/);
 assert.match(js,/ui\.returnTo==='library'/);
});
test('Mobile has deliberate reflow rather than shrinking a legacy dashboard',()=>{
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/\.disciplines\{grid-template-columns:1fr/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/id="themeSwitch"/);
});
test('73 restricted research entries are not automatically made installable by design',()=>{
 const inventory=JSON.parse(fs.readFileSync(path.join(root,'challengers.json'),'utf8'));
 assert.equal(inventory.projects.length,152);
 const research=inventory.projects.filter(x=>x.reviewStatus==='research-candidate-unverified');
 assert.equal(research.length,73);
 for(const row of research){assert.equal(row.installable,false);assert.equal(row.installAdapter,null)}
});
