'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
function context(apps=[]){
 const start=app.indexOf('let discoverySignature='),end=app.indexOf('function cardMarkup(a){',start);
 assert.ok(start>0&&end>start,'Discovery functions not found');
 const ctx={
  state:{apps},window:{ChallengerUX:{highlight:s=>String(s),globalResults:s=>[s]}},
  competitorTargets:a=>a.competition||[],
  escapeHTML:s=>String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])),
  Date,Intl,console,ui:{search:''}
 };
 return vm.runInNewContext(app.slice(start,end)+'\n({cleanCompetitorCompany,readableCompetitor,competitorMarkup,dailyRecommendation,discoveryTopics,discoveryDay})',ctx);
}
test('missing/unverified manufacturer never renders a placeholder or arrow',()=>{
 const {competitorMarkup}=context();
 const value=competitorMarkup({competition:[{company:null,product:'Airtable / GUI for PostgreSQL'}]});
 assert.match(value,/Airtable \/ GUI for PostgreSQL/);
 assert.doesNotMatch(value,/Vendor|Unknown|→/i);
 assert.equal(competitorMarkup({competition:[]}), '');
});
test('known competitors format names without arrows or repeated makers',()=>{
 const {competitorMarkup,readableCompetitor}=context();
 const result=competitorMarkup({competition:[{company:'Adobe',product:'Photoshop'},{company:'Ableton',product:'Ableton Live'}]});
 assert.match(result,/<strong>Adobe<\/strong>/);
 assert.match(result,/>Photoshop<\/span>/);
 assert.doesNotMatch(result,/→|Vendor to verify/);
 assert.equal(readableCompetitor({company:'Ableton',product:'Ableton Live'}),'Ableton Live');
});
test('competitor CSS wraps long names and never truncates Grid or List chips',()=>{
 assert.match(css,/\.cards \.card-competitors[\s\S]*?max-height:none!important;overflow:visible!important/);
 assert.match(css,/\.cards \.competitor-pair>span:last-child[\s\S]*?white-space:normal!important/);
 assert.match(css,/\.cards\.list-view \.card-competitors\{[^}]*max-height:none!important/);
});
test('daily selection is stable within the day and rotates tomorrow',()=>{
 const apps=Array.from({length:23},(_,i)=>({discovery:true,repo:'app'+i,repoUrl:'https://github.com/demo/'+i,title:'Project '+i,researchPendingVerification:false}));
 const {dailyRecommendation}=context(apps);
 for(const day of [20736,20737,20738]){
  assert.equal(dailyRecommendation(day).repo,dailyRecommendation(day).repo);
  assert.notEqual(dailyRecommendation(day).repo,dailyRecommendation(day+1).repo);
 }
});
test('previously tracked repositories take priority over unverified research',()=>{
 const apps=[
  {discovery:true,repo:'tracked',title:'Tracked',repoUrl:'https://github.com/demo/tracked',researchPendingVerification:false},
  {discovery:true,repo:'research',title:'Research',repoUrl:'https://github.com/demo/research',researchPendingVerification:true}
 ];
 const {dailyRecommendation}=context(apps);
 for(let day=20736;day<20750;day++)assert.equal(dailyRecommendation(day).repo,'tracked');
});
test('rotating suggestions diversify makers when options exist',()=>{
 const apps=['Adobe','Microsoft','Ableton','Autodesk','Apple','Blackmagic Design'].map((company,i)=>({
  repo:'demo'+i,competition:[{company,product:'Tool'+i}],discovery:true
 }));
 const {discoveryTopics}=context(apps);
 const topics=discoveryTopics(apps,20736,null);
 assert.equal(topics.length,4);
 assert.equal(new Set(topics.map(x=>x.company)).size,4);
});
test('hero and daily buttons only navigate within existing catalog',()=>{
 for(const id of ['contextHero','heroContextAction','heroContextLine1','heroContextLine2','dailyPickTitle','dailyPickOpen','dailyPickWhy','challengeLinks'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/\$\('heroContextAction'\)\.addEventListener\('click',activateHeroFeature\)/);
 assert.match(app,/\$\('dailyPickOpen'\)\.addEventListener/);
 assert.match(app,/setFilter\('all'\);\s*selectApp\(repo\)/);
 assert.doesNotMatch(app.slice(app.indexOf('function activateHeroFeature(){'),app.indexOf('function cardMarkup(a){')),/api\('POST'|\/api\/install|\/api\/update-all/);
});
test('daily loading state is accessible and actions disabled until data arrives',()=>{
 assert.match(html,/id="dailyPick"[^>]*aria-busy="true"/);
 assert.match(html,/id="dailyPickOpen"[^>]*disabled/);
 assert.match(app,/\$\('dailyPick'\)\.setAttribute\('aria-busy','false'\)/);
});
