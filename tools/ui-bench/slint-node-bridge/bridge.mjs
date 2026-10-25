import * as slint from 'slint-ui';
import {performance} from 'node:perf_hooks';
import {readFromRealEngine,filterCatalog,categoriesOf} from './live-catalog.mjs';

const start=performance.now();
const smoke=process.argv.includes('--smoke');
const source=await readFromRealEngine();
const spec=slint.loadFile(new URL('./main.slint',import.meta.url));
const window=new spec.AppWindow();
let all=source.items;
let visible=[];
let selectedId=null;
let refreshing=false;

function selectDetail(item){
 const x=item||{name:'No matches',initial:'?',maker:'',summary:'Try another search',
  platforms:'',category:'',source:'',evidence:''};
 window.detail_name=x.name;
 window.detail_initial=x.initial;
 window.detail_maker=x.maker;
 window.detail_summary=x.summary;
 window.detail_platforms=x.platforms;
 window.detail_category=x.category;
 window.detail_source=x.source;
 window.detail_evidence=x.evidence;
}
function update(){
 visible=filterCatalog(all,window.search_term,window.active_category);
 if(!visible.some(p=>p.id===selectedId))selectedId=visible[0]?.id||null;
 window.entries=new slint.ArrayModel(visible.map(x=>({
  id:x.id,initial:x.initial,name:x.name,maker:x.maker,
  summary:x.summary,category:x.category,evidence:x.evidence,
  platforms:x.platforms,source:x.source
 })));
 window.visible_total=visible.length;
 window.total=all.length;
 window.selected_index=Math.max(0,visible.findIndex(p=>p.id===selectedId));
 selectDetail(visible.find(p=>p.id===selectedId));
}
function init(data){
 all=data.items;
 window.categories=new slint.ArrayModel(categoriesOf(all));
 update();
}
window.search_changed=(query)=>{
 window.search_term=String(query);
 update();
};
window.category_changed=(name)=>{
 window.active_category=String(name);
 update();
};
window.selected=(index)=>{
 const found=visible[Number(index)];
 if(!found)return;
 selectedId=found.id;
 window.selected_index=Number(index);
 selectDetail(found);
};
window.refresh_requested=async()=>{
 if(refreshing)return;
 refreshing=true;
 try{
  const current=await readFromRealEngine();
  init(current);
  console.log('SLINT_LIVE_REFRESH_OK '+JSON.stringify({count:all.length,version:current.engineVersion}));
 }catch(err){
  console.error('SLINT_LIVE_REFRESH_FAILED '+String(err.message));
 }finally{refreshing=false}
};
init(source);
if(window.entries.rowCount()!==181||window.visible_total!==181||window.categories.rowCount()<2)
 throw Error('Incomplete native Slint model');

if(smoke){
 setTimeout(()=>{
  try{
   // Test real UI callback -> Node search -> native model update, without OS edits.
   window.search_changed('Composa');
   if(!window.visible_total||!visible.some(x=>x.name==='Composa'))
    throw Error('Slint native search callback failed');
   window.search_changed('');
   if(window.visible_total!==181)throw Error('Full catalog was not restored');
   console.log('SLINT_NODE_LIVE_GUI_PASS '+JSON.stringify({
    version:source.engineVersion,counts:source.counts,
    platform:source.hostPlatform,arch:source.hostArch,
    nativeRenderer:true,webView:false,liveBackendRead:true,
    networkScanDisabled:true,writeActionsExposed:false,
    visible:window.visible_total,categories:window.categories.rowCount(),
    startToReadyMs:Math.round(performance.now()-start)
   }));
   window.hide();slint.quitEventLoop();
  }catch(e){
   console.error('SLINT_NODE_LIVE_GUI_FAIL '+String(e.stack||e));
   process.exitCode=2;window.hide();slint.quitEventLoop();
  }
 },550);
}
await window.run();
