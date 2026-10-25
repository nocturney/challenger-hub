'use strict';
/* Cross-platform, evidence-labelled compatibility in Explore and product details.
 * No installer capabilities are added or inferred by this presentation layer. */
(function(){
 const currentRow=renderRow,currentDocument=renderDocument;
 const supported=[['win32','Windows','W'],['darwin','macOS','M'],['linux','Linux','L']];
 function fallback(a,os){
  const names=Array.isArray(a.reportedPlatforms)?a.reportedPlatforms:[];
  const pattern=os==='win32'?/\bwindows\b/i:os==='darwin'?/\bmacos\b|\bmac\s*os\b|\bos\s*x\b/i:/\blinux\b|\bubuntu\b|\bdebian\b|\bfedora\b/i;
  const reported=names.some(x=>typeof x==='string'&&pattern.test(x));
  return {state:reported?'reported':'unknown',reported,installReady:false,
   portableReady:false,evidence:reported?'curated-report-only':'not-established'};
 }
 function status(a,os){
  const entry=a.platformAvailability?.entries?.[os];
  return entry&&typeof entry.state==='string'?entry:fallback(a,os);
 }
 const label=s=>({
  'install-ready':'Verified installer on this computer',
  'portable-ready':'Verified download on this computer',
  'adapter-reviewed':'Reviewed adapter exists; package is not verified here',
  'reported':'Platform support is reported, but no approved installer is confirmed',
  'unknown':'Platform support not established'
 })[s]||'Unconfirmed';
 function badges(a,detail=false){
  return supported.map(([os,name,abbr])=>{
   const x=status(a,os),current=a.platformAvailability?.currentPlatform===os||
    (!a.platformAvailability&&snapshot?.platform===os);
   const cls=x.state==='install-ready'||x.state==='portable-ready'?'ready':
    x.state==='adapter-reviewed'?'reviewed':x.state==='reported'?'reported':'unknown';
   return '<span class="platform-badge '+cls+(current?' current':'')+'" title="'+
    esc(name+': '+label(x.state)+(current?' (this computer)':''))+
    '" aria-label="'+esc(name+': '+label(x.state))+'">'+(detail?esc(name):abbr)+
    (current?'<span aria-hidden="true"> · this PC</span>':'')+'</span>';
  }).join('');
 }
 renderRow=function(app,library=false){
  const html=currentRow(app,library);
  const info='<span class="row-platforms" aria-label="Platform compatibility">'+badges(app)+'</span>';
  return html.replace(/(<td class="status-cell [^"]*">[^<]*)(<\/td>)/,
   (_match,left,right)=>left+info+right);
 };
 renderDocument=function(app){
  currentDocument(app);
  const panel=document.querySelector('#projectDocument .doc-aside');
  if(!panel)return;
  const os=app.platformAvailability?.currentPlatform||snapshot?.platform||'unknown';
  const a=status(app,os);
  const action=a.installReady?'An approved installer is available for this computer; explicit approval is required.':
   a.portableReady?'A vetted portable download is available on this computer; no installation occurs automatically.':
   'No verified installation action is enabled for this computer.';
  const box='<section class="document-section platform-availability-card">'+
   '<h2>Operating systems</h2><div class="platform-badges">'+badges(app,true)+'</div>'+
   '<p class="platform-local-message">'+esc(action)+'</p>'+
   '<p class="platform-trust-note">Reported support, reviewed adapters and verified local packages are different. '+
   'Unknown does not mean unsupported. Never assume a source-linked project can be safely installed.</p></section>';
  panel.insertAdjacentHTML('afterbegin',box);
 };
})();
