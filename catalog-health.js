'use strict';
/* GitHub source health is not equivalent to the product's operational status.
   Do not call stable or slowly released projects "abandoned" without evidence. */
const DAY=86400000;
function assess(repo,now=Date.now()){
 if(!repo||typeof repo!=='object'||!repo.lastObservedAt)
  return {state:'unverified',needsReview:true,source:'GitHub source metadata missing'};
 const push=Date.parse(repo.pushedAt||''),at=Date.parse(repo.lastObservedAt);
 const daysSincePush=Number.isFinite(push)?Math.max(0,Math.floor((now-push)/DAY)):null;
 let state='active';
 if(repo.isArchived)state='archived';
 else if(repo.isDisabled)state='disabled';
 else if(daysSincePush===null)state='activity-unavailable';
 else if(daysSincePush>=365)state='quiet-12m';
 else if(daysSincePush>=180)state='quiet-6m';
 const needsReview=state!=='active';
 return {state,needsReview,archived:!!repo.isArchived,disabled:!!repo.isDisabled,
  daysSincePush,checkedAt:Number.isFinite(at)?new Date(at).toISOString():null,
  lastPush:repo.pushedAt||null,observedRelease:repo.observedTag||null,
  source:'Official GitHub repository metadata',
  caveat:'Repository activity alone does not establish whether an application is abandoned or supported through another channel'};
}
function summary(items,now=Date.now()){
 const a=Object.values(items||{}).map(x=>assess(x,now));
 const count=x=>a.filter(y=>y.state===x).length;
 return {checked:a.length,archived:count('archived'),disabled:count('disabled'),
  quiet12mo:count('quiet-12m'),quiet6mo:count('quiet-6m'),
  active:count('active'),unknown:count('unverified')+count('activity-unavailable'),
  needsReview:a.filter(x=>x.needsReview).length};
}
module.exports={assess,summary};
