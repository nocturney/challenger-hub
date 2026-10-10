'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const windows=path.join(__dirname,'..','platform','windows');
test('Windows native tag resolution preserves node exit status',()=>{
 for(const file of ['Install-CraftSuite.ps1','Install-WordCraft-Portable.ps1']){
  const src=fs.readFileSync(path.join(windows,file),'utf8');
  assert.match(src,/\$tag\s*=\s*\[string\]\(& \$node \$resolver \$repo\)/);
  assert.doesNotMatch(src,/& \$node \$resolver \$repo\s*\|\s*Select-Object/);
  assert.match(src,/\$LASTEXITCODE\s*-ne\s*0/);
 }
});
test('verified signatures and checksums remain mandatory',()=>{
 const install=fs.readFileSync(path.join(windows,'Install-CraftSuite.ps1'),'utf8');
 const portable=fs.readFileSync(path.join(windows,'Install-WordCraft-Portable.ps1'),'utf8');
 for(const src of [install,portable]){
  assert.match(src,/SHA256/i);assert.match(src,/Get-AuthenticodeSignature/);
  assert.match(src,/curl\.exe/);
  assert.match(src,/storytold/i);
 }
 assert.match(install,/msiexec\.exe/);
});
