'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const source=(start,end)=>{
 const i=app.indexOf(start),j=app.indexOf(end,i+start.length);
 assert.ok(i>0&&j>i,'Required workspace function anchors missing '+start);
 return app.slice(i,j);
};
test('new workspace is explicitly versioned and offers two accessible modes',()=>{
 assert.match(html,/data-app-version="2\.7\.0"/);
 assert.match(html,/data-workspace-mode="explore" aria-pressed="true"/);
 assert.match(html,/data-workspace-mode="focus" aria-pressed="false"/);
 assert.match(html,/role="group" aria-label="Workspace layout"/);
});
test('focus summary is sourced from catalog counts, not fabricated telemetry',()=>{
 const fn=source('function renderWorkspaceOverview(list){','function initializeWorkspaceNavigation(){');
 assert.match(fn,/state\.apps\.length/);
 assert.match(fn,/state\.apps\.filter\(a=>!!a\.installedVersion\)/);
 assert.match(fn,/list\.length\+' matching project'/);
 assert.match(fn,/\$\('contextHero'\)\.dataset\.context/);
});
test('workspace preferences are stored locally and default to Explore',()=>{
 assert.match(app,/workspaceMode:pref\('workspaceMode','explore'\)==='focus'\?'focus':'explore'/);
 const fn=source('function setWorkspaceMode(mode){','function setDomainsExpanded(expanded){');
 assert.match(fn,/savePref\('workspaceMode',mode\)/);
 assert.match(fn,/updateWorkspaceControls\(\)/);
 assert.doesNotMatch(fn,/api\(|fetch\(|POST|install/i);
});
test('all categories remain available behind explicit disclosure',()=>{
 assert.match(html,/id="domainExpandButton"[^>]*aria-controls="domainFilters" aria-expanded="false"/);
 assert.match(css,/domain-section:not\(\.domains-expanded\) \.domain-pill\.active\{display:flex!important\}/);
 const fn=source('function setDomainsExpanded(expanded){','function setFacetsExpanded(expanded){');
 assert.match(fn,/savePref\('domainsExpanded'/);
 assert.doesNotMatch(fn,/api\(|fetch\(|POST/);
});
test('advanced filters can collapse without erasing their active values',()=>{
 assert.match(html,/id="facetToggle"[^>]*aria-controls="catalogFilters" aria-expanded="false"/);
 assert.match(app,/\['maturity','availability','platform','category','creator'\]\.filter\(k=>ui\[k\]!=='all'\)/);
 assert.match(app,/\$\('catalogFilters'\)\.hidden=!facets/);
 assert.match(css,/#catalogFilters\[hidden\]\{display:none!important\}/);
});
test('focus only hides editorial surfaces; it never removes catalog or queue',()=>{
 assert.match(css,/:root\[data-workspace-mode=focus\] #discoveryStage,/);
 assert.match(css,/#challengeWorkflows\{display:none!important\}/);
 assert.match(html,/id="focusDailyOpen" disabled/);
 const fn=source('function initializeWorkspaceNavigation(){','function stageOf(app){');
 assert.match(fn,/\$\('dailyPickOpen'\)\.click\(\)/);
 assert.doesNotMatch(fn,/api\('POST'|\/api\/install|\/api\/update-all/);
 for(const id of ['cards','queueToolbarButton','queueDialog','filterChips','domainFilters']){
  assert.ok(html.includes('id="'+id+'"'),'existing surface '+id);
 }
});
test('mobile controls keep intrinsic widths contained without document overflow',()=>{
 assert.match(css,/grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(css,/\.tabbar \.filter-chips\{width:100%!important;overflow-x:auto!important/);
 assert.match(css,/@media\(max-width:380px\)/);
});
