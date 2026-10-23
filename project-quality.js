'use strict';
// Editorial completeness is separate from source validity and from installer approval.
function assess(a){
 const summary=String(a.summary||a.description||'').trim();
 const platforms=Array.isArray(a.reportedPlatforms)?a.reportedPlatforms.filter(x=>typeof x==='string'&&x.trim()).slice(0,8):[];
 const license=typeof a.officialLicense==='string'&&a.officialLicense?a.officialLicense:
  typeof a.license==='string'&&a.license?a.license:null;
 const issues=[];
 if(summary.length<40)issues.push('Product description');
 if(!Array.isArray(a.challenges)||!a.challenges.length)issues.push('Commercial comparison');
 if(!platforms.length)issues.push('Supported platforms');
 if(!a.repositoryMetadataCheckedAt)issues.push('Current official repository observation');
 const declared=a.reviewStatus==='repository-confirmed';
 const research=a.reviewStatus==='research-candidate-unverified';
 const tier=research?'research':declared&&issues.length===0?'documented':'needs-details';
 return {profileTier:tier,profileCompleteness:{
  missing:issues,licenseKnown:!!license,licenseSource:a.officialLicense?'Official GitHub license classification':
   a.license?'Curated research record':'Not established',
  platformSource:platforms.length?'Curated project platform report':'Not established',
  sourceChecked:!!a.repositoryMetadataCheckedAt,
  descriptionSource:a.sourceDescription?'Official GitHub repository description':'Curated research summary'
 }};
}
module.exports={assess};
