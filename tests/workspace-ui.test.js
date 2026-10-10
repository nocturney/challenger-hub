'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
const between=(a,b)=>{
 const i=app.indexOf(a),j=app.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'Source boundary not found '+a);
 return app.slice(i,j);
};
const idCount=id=>(html.match(new RegExp('id="'+id+'"','g'))||[]).length;
test('Observatory 3.0 is a real replacement of the dual workspace layout',()=>{
 assert.match(html,/data-app-version="3\.1\.0"/);
 assert.equal(idCount('workspaceRailCount'),0);
 assert.equal(idCount('focusOverview'),0);
 assert.equal(idCount('workspaceContext'),1);
 assert.equal(idCount('activityWorkspace'),1);
 assert.match(css,/CHALLENGER HUB 3\.0/);
});
test('there is exactly one visible navigation destination for Activity / queue',()=>{
 assert.equal(idCount('queueNavButton'),1);
 for(const name of ['workQueue','queueToolbarButton','queueDockOpen','queueViewButton'])
  assert.equal(idCount(name),0,'redundant queue control '+name);
 assert.equal(idCount('queueDialog'),1,'legacy queue modal may remain for compatibility, not duplicate an entry');
 assert.match(app,/ui\.activityOpen=true;renderCards\(true\)/);
 assert.doesNotMatch(app,/\$\('queueNavButton'\)\.addEventListener\('click',.*openQueue/);
});
test('primary sidebar nav maps one-to-one to meaningful destinations',()=>{
 for(const dest of ['all','installed','updates'])assert.match(html,new RegExp('data-nav="'+dest+'"'));
 assert.doesNotMatch(html,/data-nav="new"/);
 assert.equal((html.match(/data-nav=/g)||[]).length,3);
 assert.match(html,/id="queueNavButton"[^>]*aria-label="Open activity and queue"/);
 assert.match(app,/const page=global\?'search':ui\.activityOpen\?'activity'/);
 assert.match(app,/activityNav\.classList\.toggle\('active',page==='activity'\)/);
});
test('status filters no longer clone Installed and Updates destinations',()=>{
 const chips=html.slice(html.indexOf('id="filterChips"'),html.indexOf('id="facetToggle"'));
 assert.match(chips,/data-filter="all"/);
 assert.match(chips,/data-filter="new"/);
 assert.match(chips,/data-filter="missing"/);
 assert.doesNotMatch(chips,/data-filter="installed"|data-filter="updates"/);
 assert.equal(idCount('metricInstalled'),0,'hero must not repeat sidebar counters');
 assert.equal(idCount('metricUpdates'),0);
 assert.equal(idCount('metricNew'),0);
 assert.equal(idCount('heroContextAction'),1,'deprecated hidden CTA kept to preserve behavior but not visible');
 assert.match(html,/id="heroContextAction"[^>]*hidden tabindex="-1"/);
});
test('device-specific operations live inside their respective destinations',()=>{
 assert.equal(idCount('verifyButton'),1);
 assert.equal(idCount('sidebarScan'),1);
 const t=between('function syncV3Architecture(list){','function renderCards(force=false){');
 assert.match(t,/\$\('verifyButton'\)\.hidden=page!=='installed'/);
 assert.match(t,/\$\('sidebarScan'\)\.hidden=page!=='updates'/);
 assert.match(css,/:root\[data-hub-page=installed\] \.main-heading,/);
 assert.match(css,/:root\[data-hub-page=updates\] \.tabbar\{display:none!important\}/);
});
test('Activity presents truthful state and historical recovery independently from queue actions',()=>{
 const a=between('function renderActivityWorkspace(){','function renderBulkUpdateBar(){');
 for(const term of ['queueErrors()','latestQueueOutcomes()','state.history','activityCurrentText','activityIssueCount','recovered'])
  assert.ok(a.includes(term),term);
 assert.doesNotMatch(a,/api\('POST'|\/api\/install|\/api\/update-all/);
 assert.match(html,/id="activityHistoryRows"/);
 assert.match(html,/id="activityCurrentText"/);
 assert.match(html,/id="activityWaitingRows"/);
});
test('appearance is in Settings and there is no duplicate header source status',()=>{
 assert.equal(idCount('themeSwitch'),1);
 assert.ok(html.indexOf('id="themeSwitch"')>html.indexOf('id="prefsDialog"'));
 assert.equal(idCount('headerSourceLabel'),0);
 assert.match(css,/:root\[data-theme=light\] \.sidebar\{/);
 assert.match(css,/:root\[data-theme=light\] \.sidebar-nav #queueNavButton/);
});
test('content safeguards retain real source data and eliminate network changes',()=>{
 assert.match(app,/data=await api\('GET','\/api\/state'\)/);
 assert.match(app,/\['installed','updates'\]\.includes\(ui\.filter\)/);
 assert.match(html,/id="dailyPickOpen"[^>]*disabled/);
 assert.match(app,/function dailyRecommendation\(/);
 assert.match(app,/function safeGitHubUrl\(/);
 const registry=JSON.parse(fs.readFileSync(path.join(root,'challengers.json'),'utf8'));
 const unverified=registry.projects.filter(p=>p.reviewStatus==='research-candidate-unverified');
 assert.equal(registry.projects.length,152);
 assert.equal(unverified.length,73);
 for(const app of unverified){assert.equal(app.installable,false);assert.equal(app.installAdapter,null)}
});
test('responsive screen and accessibility affordances are part of new system',()=>{
 assert.match(css,/@media\(max-width:810px\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/id="activityWorkspace"[^>]*aria-label=/);
 assert.match(html,/id="workspaceContext"[^>]*aria-label=/);
});
