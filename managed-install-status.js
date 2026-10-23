'use strict';
/* Adapted from ArtCraft Launcher's typed state separation, not copied code.
 * Release observation is NOT the same as an install-approved asset.
 * Detection in an OS location does NOT prove Challenger owns installation.
 */
function assess(app){
 const installed=!!(app?.installedVersion||app?.installedPath);
 const owner=installed?'Unattributed local installation':'Not installed';
 const release=!!(app?.releaseTag||app?.latestVersion);
 const sourceError=!!app?.error;
 const noRelease=!release&&/no published release yet/i.test(app?.assetIssue||'');
 const compatible=!!app?.installable;
 let state='Checking';
 if(installed){
  if(sourceError||!release)state='InstalledCheckUnavailable';
  else if(app.needsUpdate)state='UpdateAvailable';
  else if(app.current)state='UpToDate';
  else state='InstalledVersionUnknown';
 }else if(noRelease)state='NoRelease';
 else if(sourceError)state='SourceUnavailable';
 else if(release)state=compatible?'Available':'NoCompatibleAsset';
 return {state,origin:owner,ownerVerified:false,mayAutoReplace:false,
  releaseChecked:release&&!sourceError,localPresent:installed,hasCompatibleAsset:compatible,
  note:installed?'Detected path/version does not identify its installer; replacement requires user approval and source verification':
   'A catalog entry is not proof of a platform installer'};
}
module.exports={assess};
