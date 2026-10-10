'use strict';
// Resolve only official GitHub releases. Does not download or install applications.
const allow=new Set('photocraft vectorcraft lightcraft filmcraft effectcraft designcraft pdfcraft wordcraft gridcraft deckcraft cadcraft soundcraft'.split(' '));
const tagSyntax=/^v?[0-9][a-zA-Z0-9._+-]{0,80}$/;
const stableTag=/^v?[0-9]+\.[0-9]+\.[0-9]+(?:\.[0-9]+)?$/;
const headers={'User-Agent':'ChallengerHub-official-release-resolver/2.5.8'};
function parse(repo,location){
 if(!allow.has(repo))throw Error('Repository not approved');
 let u;try{u=new URL(location)}catch(_){throw Error('Invalid official redirect')}
 const p='/storytold/'+repo+'/releases/tag/';
 if(u.origin!=='https://github.com'||u.username||u.password||u.search||u.hash||!u.pathname.startsWith(p))throw Error('Redirect does not point to an approved GitHub release');
 let tag;try{tag=decodeURIComponent(u.pathname.slice(p.length))}catch(_){throw Error('Invalid tag encoding')}
 if(!tagSyntax.test(tag))throw Error('Unsafe release tag');
 return tag;
}
async function lookupRedirect(repo,request=fetch){
 const url='https://github.com/storytold/'+repo+'/releases/latest';
 const response=await request(url,{redirect:'manual',headers,signal:AbortSignal.timeout(13000)});
 try{
  if(![301,302,303,307,308].includes(response.status))throw Error('Latest-release redirect HTTP '+response.status);
  return parse(repo,response.headers.get('location'));
 }finally{if(response.body)await response.body.cancel().catch(()=>{})}
}
async function readSmall(response,limit){
 if(!response.body)throw Error('Empty official release feed');
 const reader=response.body.getReader(),chunks=[];let length=0;
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>limit)throw Error('Official release feed exceeds safety limit');
   chunks.push(Buffer.from(value));
  }
 }finally{await reader.cancel().catch(()=>{})}
 return Buffer.concat(chunks).toString('utf8');
}
function parseFeed(repo,xml){
 if(!allow.has(repo))throw Error('Repository not approved');
 if(typeof xml!=='string'||xml.length>350000||!/^\s*<\?xml\b/.test(xml)||!xml.includes('<feed xmlns="http://www.w3.org/2005/Atom"'))throw Error('Invalid official Atom release feed');
 if(!xml.includes('<id>tag:github.com,2008:https://github.com/storytold/'+repo+'/releases</id>'))throw Error('Atom feed repository identity mismatch');
 const entries=xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/g)||[];
 for(const entry of entries){
  for(const link of entry.match(/<link\b[^>]*>/g)||[]){
   const match=link.match(/\bhref="([^"]+)"/);
   if(!match)continue;
   let tag;
   try{tag=parse(repo,match[1])}catch(_){continue}
   if(!stableTag.test(tag))continue;
   return tag;
  }
 }
 throw Error('No stable, verified-release tag in official Atom feed');
}
async function lookupFeed(repo,request=fetch){
 const url='https://github.com/storytold/'+repo+'/releases.atom';
 const response=await request(url,{redirect:'manual',headers,signal:AbortSignal.timeout(13000)});
 if(response.status!==200){
  if(response.body)await response.body.cancel().catch(()=>{});
  throw Error('Official Atom feed HTTP '+response.status);
 }
 if(!String(response.headers.get('content-type')||'').toLowerCase().includes('application/atom+xml')){
  if(response.body)await response.body.cancel().catch(()=>{});
  throw Error('Unexpected Atom content type');
 }
 return parseFeed(repo,await readSmall(response,350000));
}
async function latest(repo,request=fetch){
 if(!allow.has(repo))throw Error('Unapproved Craft application');
 let firstError;
 try{return await lookupRedirect(repo,request)}catch(e){firstError=e}
 try{return await lookupFeed(repo,request)}
 catch(secondError){
  // Retry one time for transient network failures; never hammer rate-limited 403/429.
  if(!/HTTP (403|429)\b/.test(String(firstError.message||''))){
   await new Promise(resolve=>setTimeout(resolve,750));
   try{return await lookupRedirect(repo,request)}catch(_){}
  }
  throw Error('Official release verification unavailable ('+String(firstError.message).slice(0,96)+'; fallback: '+String(secondError.message).slice(0,110)+')');
 }
}
if(require.main===module)latest(String(process.argv[2]||'').toLowerCase()).then(tag=>process.stdout.write(tag+'\n')).catch(e=>{process.stderr.write('Release lookup failed: '+e.message+'\n');process.exitCode=2});
module.exports={allow,parse,parseFeed,lookupRedirect,lookupFeed,latest};
