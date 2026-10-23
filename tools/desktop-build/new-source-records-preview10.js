/* Preview 10: public source-verified new candidates join primary search.
 * These are informational records ONLY, never installer-adapter records.
 * Kept outside the vetted server registry until a separate adapter review.
 */
function sourceCandidatesForDiscovery(existing){
 const list=window.CHALLENGER_CANDIDATE_WATCHLIST;
 if(!list||list.schema!=='challenger-candidate-watchlist.v1')return [];
 const names=new Set((existing||[]).map(a=>String(a.repository||'').toLowerCase()));
 return (list.candidates||[]).filter(a=>
   a.assessment==='new-unreviewed'&&a.installable===false&&a.installerAdapter===null&&
   typeof a.repository==='string'&&/^[-\w.]+\/[-\w.]+$/.test(a.repository)&&
   a.repoUrl==='https://github.com/'+a.repository&&
   !names.has(a.repository.toLowerCase())).map(a=>({
   repo:'candidate-'+a.id,
   title:a.title,creator:a.repository.split('/')[0],repository:a.repository,
   repoUrl:a.repoUrl,releaseUrl:a.releaseUrl||null,
   category:a.category,group:a.category,
   summary:a.description||a.whyReview,description:a.description||a.whyReview,
   caveats:a.whyReview,
   sourceDescription:a.description||null,
   sourceSignal:{sourceLabel:'Official GitHub source · research only',checkedAt:a.checkedAt},
   repositoryMetadataCheckedAt:a.checkedAt,
   publishedAt:a.releaseDate||null,
   observedPublishedAt:a.releaseDate||null,
   observedReleaseTag:a.latestPublishedStableTag||null,
   pushedAt:a.pushedAt||null,
   primaryLanguage:a.language||null,
   license:a.officialLicense||null,officialLicense:a.officialLicense||null,
   reportedPlatforms:[],challenges:[],
   researchPendingVerification:true,profileTier:'research',
   profileCompleteness:{missing:['OS/platform compatibility','Installation package verification']},
   repositoryHealth:{state:a.archived?'archived':'active',checkedAt:a.checkedAt},
   discovery:true,candidateWatch:true,
   candidateKind:a.kind||'desktop',installable:false,installAdapter:null,installerAdapter:null,
   needsUpdate:false,installedVersion:null,downloadablePortable:false
 }));
}
