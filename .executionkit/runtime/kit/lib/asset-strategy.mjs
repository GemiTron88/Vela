// Media plans are advisory source evidence, not fabricated Gemini images or image acceptance.
// Heavy generation happens in the authorized host only after project/brand discovery.
export function sourceVisualAssetPlan(source,{maxPages=12}={}){
  const pages=[];
  for(const {rel,body} of source){
    if(pages.length>=maxPages)break;
    if(!/\.(?:blade\.php|html?|jsx|tsx|vue|svelte)$/i.test(rel)||
      !/(?:<h1\b|<main\b|hero\b|landing\b)/i.test(body))continue;
    const hasMedia=/(?:<img\b|<picture\b|<video\b|<canvas\b|<svg\b|background-image\s*:|url\([^)]*\.(?:png|jpe?g|webp|avif|svg)|Image\.asset\b)/i.test(body);
    pages.push({path:rel,coverage:hasMedia?'SOURCE_MEDIA_REFERENCED':'MEDIA_NOT_EVIDENT',
      suggestedRoles:hasMedia?[]:['hero-context','service-illustration','supporting-visual'],
      generation:{preferredProvider:'gemini',trigger:'HOST_APPROVED_MEDIA_TASK_ONLY',localOutputRequired:true,brandConsistent:true,realProductFactsOnly:true},
      verification:'Rendered asset availability, relevance, mobile crop, alt text and image-bound critic required'});
  }
  return {schemaVersion:'executionkit-visual-assets-plan/v1',scope:'SOURCE_HINTS_NOT_VISUAL_PASS',pages};
}
export function reviewRenderedMedia(g){
  if(g.platform!=='web'||!Array.isArray(g.nodes))return [];
  const h1=g.nodes.some(n=>n.tag==='h1'&&n.rect?.y<g.viewport.height);
  const main=g.nodes.some(n=>n.tag==='main');
  if(!h1||!main)return [];
  const useful=g.nodes.some(n=>{
    const r=n.rect??{},area=(r.width??0)*(r.height??0);
    return r.y<g.viewport.height&&r.y+(r.height??0)>0&&area>=12000&&
      (['img','video','canvas'].includes(n.tag)||n.tag==='svg'&&!n.iconControl||n.mediaBackground);
  });
  return useful?[]:[{category:'VISUAL_MEDIA_RICHNESS_REVIEW',severity:'review',
    reason:'First-fold marketing content has no substantial observed media; independently judge whether Gemini-generated local brand-specific art would improve clarity.',
    observedEvidence:{viewport:g.viewport,source:'observed DOM media footprint'},
    recommendedRemediation:'Where useful, create relevant brand-aligned Gemini imagery, store optimized files locally with accessible descriptions, then recapture and inspect.',
    acceptanceCriteria:'Real rendered image is relevant, locally served, properly cropped on mobile, and independently reviewed; sparse intentional designs require explicit image-bound disposition.'}];
}
